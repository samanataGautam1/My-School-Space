const express = require('express');
const prisma = require("../../../prisma/prisma");
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { calculateStudentMetrics } = require('../teacher/analyticsHelper');
const { getGradeFromMarks, evaluateSubjectResult, calculateOverallGPA } = require('../../utils/nepalGrading');

const router = express.Router();

router.use(authMiddleware, allowRoles('PARENT'));

/* ================= OVERVIEW ================= */
router.get('/overview', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parentRecord = await prisma.parent.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        let activeSession = { session: null, year: null, terminal: null, isActive: false };
        if (parentRecord) {
            const school = await prisma.school.findUnique({
                where: { id: parentRecord.schoolId },
                select: { activePerformanceSession: true, activePerformanceYear: true, activeExamTerminal: true }
            });
            if (school) {
                activeSession = {
                    session: school.activePerformanceSession || null,
                    year: school.activePerformanceYear || null,
                    terminal: school.activeExamTerminal || (school.activePerformanceSession ? school.activePerformanceSession.replace('Session', 'Term') : null),
                    isActive: !!school.activePerformanceSession
                };
            }
        }

        res.json({ ok: true, data: { message: "Parent Dashboard Overview", activeSession } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch overview' });
    }
});

/* ================= NOTIFICATIONS ================= */
router.get('/notifications', async (req, res) => {
    try {
        const userId = Number(req.user.userId);

        const parent = await prisma.parent.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        const notifications = await prisma.notification.findMany({
            where: { parentId: parent.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({ ok: true, data: notifications });
    } catch (err) {
        console.error("Parent Notifications Error:", err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/* ================= MESSAGES (ADMIN) ================= */

router.get('/messages', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        // Using raw query to avoid Prisma sync issues
        const users = await prisma.$queryRaw`
            SELECT u.id, u.schoolId, s.adminId 
            FROM user u 
            LEFT JOIN school s ON u.schoolId = s.id 
            WHERE u.id = ${userId}
        `;

        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = users[0];

        if (!user.schoolId || !user.adminId) return res.json({ ok: true, data: [] });

        const messages = await prisma.$queryRaw`
            SELECT * FROM message 
            WHERE (fromUserId = ${userId} AND toUserId = ${user.adminId})
               OR (fromUserId = ${user.adminId} AND toUserId = ${userId})
            ORDER BY createdAt ASC
        `;

        res.json({ ok: true, data: messages });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Multer for parent message file attachments
const _multer = require('multer');
const _msgStorage = _multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = require('path').join(__dirname, '../../uploads/messages');
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = require('path').extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});
const _uploadMsgFile = _multer({ storage: _msgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/messages/send', _uploadMsgFile.single('file'), async (req, res) => {
    try {
        const { subject, body } = req.body;
        const userId = Number(req.user.userId);

        const users = await prisma.$queryRaw`
            SELECT u.id, u.schoolId, s.adminId, s.parentMessagingEnabled 
            FROM user u 
            JOIN school s ON u.schoolId = s.id 
            WHERE u.id = ${userId}
        `;

        if (users.length === 0) return res.status(404).json({ error: 'School not found for user' });
        const user = users[0];

        if (!user.adminId) return res.status(404).json({ error: 'School admin not found' });
        if (user.parentMessagingEnabled === false) return res.status(403).json({ error: 'Messaging is disabled.' });

        // GATEKEEPING
        const lastMessages = await prisma.$queryRaw`
            SELECT status FROM message 
            WHERE fromUserId = ${userId} AND toUserId = ${user.adminId}
            ORDER BY createdAt DESC LIMIT 1
        `;

        if (lastMessages.length > 0 && lastMessages[0].status === 'PENDING') {
            return res.status(403).json({ error: 'Please wait for your previous message to be approved.' });
        }

        // We use prisma.message.create for simple inserts, if this fails we might need raw INSERT
        const newMessage = await prisma.message.create({
            data: {
                fromUserId: userId,
                toUserId: user.adminId,
                subject: subject || 'No Subject',
                body: body || '',
                status: 'PENDING'
            }
        });

        res.json({ ok: true, data: newMessage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/* ================= CHILDREN DATA (PERFORMANCE) ================= */

// Get Performance Analytics for all children
router.get('/children/performance', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const sessionParam = req.query.session; // Optional: "1st Session", "2nd Session", etc.

        const parentRecord = await prisma.parent.findUnique({
            where: { userId },
            select: {
                id: true, schoolId: true,
                school: { select: { id: true, studentAnalyticsEnabled: true, activePerformanceSession: true, activePerformanceYear: true } }
            }
        });

        if (!parentRecord) return res.status(404).json({ error: 'Parent not found' });
        const parent = { id: parentRecord.id, schoolId: parentRecord.schoolId, studentAnalyticsEnabled: parentRecord.school?.studentAnalyticsEnabled };

        // if (parent.studentAnalyticsEnabled === false) return res.json({ ok: true, data: [] });

        const linkedStudents = await prisma.parent.findUnique({
            where: { id: parent.id },
            select: {
                student: {
                    select: {
                        id: true, classId: true,
                        user: { select: { firstName: true, lastName: true } },
                        Renamedclass: { select: { name: true, section: true } }
                    }
                }
            }
        });
        const students = (linkedStudents?.student || []).map(s => ({
            id: s.id, firstName: s.user?.firstName, lastName: s.user?.lastName,
            classId: s.classId, className: s.Renamedclass?.name, classSection: s.Renamedclass?.section
        }));

        const performanceData = [];

        // Determine Active Session Dates (use query param if provided, else school default)
        let activeSession = sessionParam || parentRecord.school?.activePerformanceSession || "1st Session";
        let activeYear = parentRecord.school?.activePerformanceYear || 2026;

        const { getSessionDateRange, getNextSession } = require('../admin/sessionDates');
        let { startDate, endDate, autoAdvanceDate } = getSessionDateRange(activeSession, activeYear);

        // NOTE: Auto-advance removed from read-only endpoints.
        // Session advancement should only happen via admin Session Management.

        const sessionStartMonth = startDate.getMonth();
        const boundedEndDate = new Date(Math.min(endDate.getTime(), Date.now()));

        // FALLBACK LOGIC: If the active session has no calculation record, 
        // try to find the most recent COMPLETED session for this school.
        let actualActiveSession = activeSession;
        const currentTermPrefix = activeSession.split(' ')[0];
        const currentCheck = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: parent.schoolId,
                examTerminal: { startsWith: currentTermPrefix }
            }
        });

        if (!currentCheck || currentCheck.calculationStatus !== 'COMPLETED') {
            const lastCompleted = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: parent.schoolId,
                    calculationStatus: 'COMPLETED'
                },
                orderBy: { publishedAt: 'desc' }
            });

            if (lastCompleted) {
                const termToSession = { '1st': '1st Session', '2nd': '2nd Session', '3rd': '3rd Session', '4th': '4th Session' };
                const foundPrefix = lastCompleted.examTerminal.split(' ')[0];
                actualActiveSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
            }
        }

        const termPrefix = actualActiveSession.split(' ')[0];

        for (const student of students) {
            // Only show data if potentialmetric exists with COMPLETED status
            // Per PDF flow: parents see graph only after class teacher verifies
            let completedMetric = await prisma.potentialmetric.findFirst({
                where: { studentId: student.id, session: actualActiveSession, status: { in: ['COMPLETED', 'PENDING_TEACHER_REVIEW'] } },
                orderBy: { sessionYear: 'desc' }
            });

            // Fallback: if the requested session has no completed metric, use the
            // student's most recent COMPLETED metric so parents see data instead of 0/0
            // when a school's active session has been advanced past the last calculation.
            let studentSession = actualActiveSession;
            if (!completedMetric) {
                completedMetric = await prisma.potentialmetric.findFirst({
                    where: { studentId: student.id, status: { in: ['COMPLETED', 'PENDING_TEACHER_REVIEW'] } },
                    orderBy: [{ sessionYear: 'desc' }, { createdAt: 'desc' }]
                });
                if (completedMetric) studentSession = completedMetric.session;
            }

            if (!completedMetric) {
                // No completed calculation — return empty placeholder for this child
                performanceData.push({
                    studentId: student.id,
                    name: `${student.firstName} ${student.lastName}`,
                    className: `${student.className || ''}${student.classSection || ''}`,
                    performance: 0, potential: 0, finalPerformance: 0, finalY: 0,
                    exam: { value: 0, display: '—' },
                    assignment: { value: 0, display: '—' },
                    attendance: { value: 0, display: '—' },
                    potential: { total: 0, effort: { value: 0, display: '0 / 40' }, curiosity: { value: 0, display: '0 / 40' }, learningSpeed: { value: 0, display: '0 / 20' }, effortBreakdown: {} },
                    performanceBreakdown: { exam: 0, assignment: 0, attendance: 0 },
                    potentialBreakdown: {},
                    isCalculated: false,
                    status: 'NOT_CALCULATED',
                    activeSession: { session: studentSession, isDone: false },
                    performanceTrendline: [], potentialTrendline: [], trendline: []
                });
                continue;
            }

            const metrics = await calculateStudentMetrics(student.id, student.classId, startDate, boundedEndDate, studentSession, activeYear);

            // Calculate Trendlines (simplified for consistency)
            const performanceTrendline = [];
            const potentialTrendline = [];

            // Performance Trendline
            const existingMarks = await prisma.exammark.findMany({
                where: { studentId: student.id },
                select: { examTerminal: true },
                distinct: ['examTerminal']
            });

            for (const term of existingMarks) {
                const termPref = term.examTerminal.split(' ')[0];
                const termPub = await prisma.schoolexampublish.findFirst({
                    where: {
                        schoolId: parent.schoolId,
                        examTerminal: { startsWith: termPref },
                        calculationStatus: 'COMPLETED' // Relaxed status for consistency
                    }
                });
                if (termPub) {
                    const termMarks = await prisma.exammark.findMany({
                        where: { studentId: student.id, examTerminal: term.examTerminal }
                    });
                    if (termMarks.length > 0) {
                        let totalPct = 0;
                        termMarks.forEach(m => { totalPct += (m.marks / (m.fullMarks || 100)) * 100; });
                        performanceTrendline.push({
                            label: term.examTerminal.replace('Term', 'Session'),
                            score: Math.round(totalPct / termMarks.length)
                        });
                    }
                }
            }

            // Potential Trendline
            const potentialMetrics = await prisma.potentialmetric.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                take: 5
            });
            potentialMetrics.reverse().forEach(m => {
                // Use new fields first, fall back to legacy fields
                const score = m.potentialTotal ??
                    ((m.effortTotal || m.effort || 0) + (m.curiosityTotal || m.curiosityQuiz || 0) + (m.learningSpeed || 0));
                potentialTrendline.push({
                    label: `${m.session || ''} ${m.monthYear || ''}`.trim(),
                    score: Math.round(score)
                });
            });

            const perfValue = typeof metrics.performance === 'number' ? metrics.performance : (metrics.finalPerformance || 0);
            const potValue = typeof metrics.potential === 'number' ? metrics.potential : (metrics.finalPotential || 0);

            // Build structured objects matching teacher endpoint format
            const examObj = typeof metrics.exam === 'object' ? metrics.exam : { value: 0, display: '—' };
            const assignObj = typeof metrics.assignment === 'object' ? metrics.assignment : { value: 0, display: '—' };
            const attObj = typeof metrics.attendance === 'object' ? metrics.attendance : { value: 0, display: '—' };
            const potObj = metrics.potential || { total: 0, effort: { value: 0, display: '0 / 40' }, curiosity: { value: 0, display: '0 / 20' }, learningSpeed: { value: 0, display: '0 / 40' }, effortBreakdown: {} };

            performanceData.push({
                studentId: student.id,
                name: `${student.firstName} ${student.lastName}`,
                className: `${student.className || ''}${student.classSection || ''}`,
                // Numeric values for the scatter plot
                performance: perfValue,
                potential: potValue,
                finalPerformance: perfValue,
                finalY: potValue,
                // Structured objects (same format as teacher endpoint)
                exam: examObj,
                assignment: assignObj,
                attendance: attObj,
                potential: potObj,
                // Breakdown for portfolio report
                performanceBreakdown: {
                    exam: examObj.value || 0,
                    assignment: assignObj.value || 0,
                    attendance: attObj.value || 0
                },
                potentialBreakdown: metrics.potentialBreakdown || {},
                examRaw: Math.round(parseFloat(examObj.display) || examObj.value || 0),
                attendanceRaw: Math.round(parseFloat(attObj.display) || attObj.value || 0),
                isCalculated: metrics.activeSession?.isDone || false,
                status: completedMetric.status,
                activeSession: metrics.activeSession,
                performanceTrendline,
                potentialTrendline,
                trendline: potentialTrendline
            });
        }

        // Distinct sessions across all of this parent's children that have a
        // COMPLETED potentialmetric — used to populate the parent dashboard's
        // session dropdown so parents can't pick a session with no data.
        const availableSessionRows = students.length > 0
            ? await prisma.potentialmetric.findMany({
                where: { studentId: { in: students.map(s => s.id) }, status: { in: ['COMPLETED', 'PENDING_TEACHER_REVIEW'] } },
                select: { session: true, sessionYear: true },
                distinct: ['session', 'sessionYear']
            })
            : [];
        const sessionOrder = { '1st Session': 1, '2nd Session': 2, '3rd Session': 3, '4th Session': 4 };
        const availableSessions = [...new Set(availableSessionRows.map(r => r.session).filter(Boolean))]
            .sort((a, b) => (sessionOrder[a] ?? 99) - (sessionOrder[b] ?? 99));

        res.json({ ok: true, data: performanceData, availableSessions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// GET Child Monthly Performance
router.get('/child/:studentId/monthly-performance', async (req, res) => {
    try {
        const { studentId } = req.params;
        const userId = Number(req.user.userId);

        // Verify parent-student linkage
        const parent = await prisma.parent.findUnique({
            where: { userId },
            include: { student: { where: { id: parseInt(studentId) } } }
        });

        if (!parent || parent.student.length === 0) {
            return res.status(403).json({ error: "Access denied." });
        }

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { school: true, user: true } // Include user for student name
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        let actualActiveSession = activeSession;
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
                actualActiveSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
            }
        }

        const termPrefix = actualActiveSession.split(' ')[0];

        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: termPrefix }
                // Removed status: 'PUBLISHED'
            }
        });

        const isCalculated = publishRecord && (publishRecord.calculationStatus === 'COMPLETED' || publishRecord.status === 'PUBLISHED');

        let months = [];
        if (actualActiveSession.toLowerCase().includes('1st')) months = [0, 1, 2];
        else if (actualActiveSession.toLowerCase().includes('2nd')) months = [3, 4, 5];
        else if (actualActiveSession.toLowerCase().includes('3rd')) months = [6, 7, 8];
        else if (actualActiveSession.toLowerCase().includes('4th')) months = [9, 10, 11];

        const monthlyStats = [];
        let terminalResult = [];

        // Fetch monthly data regardless of isCalculated status
        for (const month of months) {
            const startDate = new Date(activeYear, month, 1);
            const endDate = new Date(activeYear, month + 1, 0, 23, 59, 59);

            const submissions = await prisma.submission.findMany({
                where: {
                    studentId: parseInt(studentId),
                    grade: { not: null },
                    submittedAt: { gte: startDate, lte: endDate }
                },
                select: { grade: true }
            });
            const assignmentAvg = submissions.length > 0
                ? submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / submissions.length
                : 0;

            const attendance = await prisma.attendance.findMany({
                where: { studentId: parseInt(studentId), date: { gte: startDate, lte: endDate } },
                select: { status: true }
            });
            const totalDays = attendance.length;
            const presentDays = attendance.filter(a => a.status === 'P').length;
            const attendancePct = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;

            monthlyStats.push({
                month: new Date(activeYear, month, 1).toLocaleString('default', { month: 'short' }),
                assignment: Math.round(assignmentAvg),
                attendance: Math.round(attendancePct)
            });
        }

        const examMarks = await prisma.exammark.findMany({
            where: {
                studentId: parseInt(studentId),
                examTerminal: { startsWith: termPrefix }
            },
            select: { subject: { select: { name: true } }, marks: true, fullMarks: true }
        });

        terminalResult = examMarks.map(m => ({
            subject: m.subject?.name || "Unknown",
            marks: m.marks,
            fullMarks: m.fullMarks
        }));

        res.json({
            ok: true,
            data: {
                studentName: `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim(),
                session: activeSession,
                monthlyStats,
                terminalResult
            }
        });

    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ================= CHILDREN DATA (ASSIGNMENTS) ================= */

router.get('/children/assignments', async (req, res) => {
    try {
        const userId = Number(req.user.userId);

        const parentRecord = await prisma.parent.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });
        if (!parentRecord) return res.status(404).json({ error: 'Parent not found' });

        const parentId = parentRecord.id;
        const schoolId = parentRecord.schoolId;

        const linkedStudents = await prisma.parent.findUnique({
            where: { id: parentId },
            select: {
                student: {
                    where: { schoolId },
                    select: {
                        id: true, firstName: true, lastName: true, classId: true,
                        Renamedclass: { select: { name: true, section: true } }
                    }
                }
            }
        });
        const students = (linkedStudents?.student || []).map(s => ({
            id: s.id, firstName: s.firstName, lastName: s.lastName,
            classId: s.classId, className: s.Renamedclass?.name, classSection: s.Renamedclass?.section
        }));

        const assignmentsData = [];
        const now = new Date();

        for (const student of students) {
            const className = student.classId
                ? `${student.className}${student.classSection ? student.classSection : ''}`
                : null;

            if (!student.classId) {
                assignmentsData.push({
                    studentId: student.id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    className: className,
                    assignments: []
                });
                continue;
            }

            // Get current session year for filtering (retained students see only current year)
            const schoolForYear = await prisma.school.findUnique({
                where: { id: schoolId },
                select: { activePerformanceYear: true }
            });
            const activeYear = schoolForYear?.activePerformanceYear || new Date().getFullYear();

            const assignments = await prisma.$queryRaw`
                SELECT a.id, a.title, a.dueDate, a.isClosed,
                       sub.name as subjectName,
                       u.firstName as tFN, u.lastName as tLN,
                       sm.id as submissionId, sm.submittedAt, sm.grade, sm.feedback
                FROM assignment a
                LEFT JOIN subject sub ON a.subjectId = sub.id
                LEFT JOIN teacher t ON a.teacherId = t.id
                LEFT JOIN user u ON t.userId = u.id
                LEFT JOIN submission sm ON sm.assignmentId = a.id AND sm.studentId = ${student.id}
                WHERE a.classId = ${student.classId}
                  AND (a.sessionYear = ${activeYear} OR a.sessionYear IS NULL)
                ORDER BY a.dueDate DESC
            `;

            const studentAssignments = assignments.map(asg => {
                const hasSubmission = asg.submissionId != null;
                let status = 'PENDING';

                if (hasSubmission) {
                    status = asg.grade != null ? 'GRADED' : 'SUBMITTED';
                } else if (asg.isClosed) {
                    status = 'MISSED';
                } else if (asg.dueDate && new Date(asg.dueDate) < now) {
                    status = 'OVERDUE';
                }

                return {
                    id: asg.id,
                    title: asg.title,
                    subject: asg.subjectName || 'General',
                    teacherName: asg.tFN ? `${asg.tFN} ${asg.tLN}` : 'N/A',
                    dueDate: asg.dueDate,
                    isClosed: Boolean(asg.isClosed),
                    submitted: hasSubmission,
                    submittedAt: hasSubmission ? asg.submittedAt : null,
                    grade: hasSubmission ? asg.grade : null,
                    feedback: hasSubmission ? asg.feedback : null,
                    status: status
                };
            });

            assignmentsData.push({
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                className: className,
                assignments: studentAssignments
            });
        }

        res.json({ ok: true, data: assignmentsData });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

/* ================= TEACHER MESSAGES ================= */

router.get('/teacher-messages', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parents = await prisma.$queryRaw`SELECT id FROM parent WHERE userId = ${userId}`;
        if (parents.length === 0) return res.status(404).json({ error: 'Parent not found' });
        const parentId = parents[0].id;

        const messages = await prisma.$queryRaw`
            SELECT tm.*, tu.firstName as tFN, tu.lastName as tLN, su.firstName as sFN, su.lastName as sLN
            FROM teachermessage tm
            JOIN teacher t ON tm.teacherId = t.id
            JOIN user tu ON t.userId = tu.id
            JOIN student s ON tm.studentId = s.id
            JOIN user su ON s.userId = su.id
            WHERE tm.parentId = ${parentId}
            ORDER BY tm.createdAt DESC
        `;

        await prisma.$executeRaw`UPDATE teachermessage SET isRead = 1 WHERE parentId = ${parentId} AND isRead = 0`;

        const data = messages.map(m => ({
            id: m.id,
            teacherName: `${m.tFN} ${m.tLN}`,
            studentName: `${m.sFN} ${m.sLN}`,
            subject: m.subject,
            body: m.body,
            isRead: Boolean(m.isRead),
            createdAt: m.createdAt
        }));

        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.get('/teacher-messages/unread-count', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parents = await prisma.$queryRaw`SELECT id FROM parent WHERE userId = ${userId}`;
        if (parents.length === 0) return res.json({ ok: true, count: 0 });
        const parentId = parents[0].id;

        const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM teachermessage WHERE parentId = ${parentId} AND isRead = 0`;
        res.json({ ok: true, count: Number(result[0].count) });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

/* ================= DAILY BRIEFING ================= */

router.get('/daily-briefing', async (req, res) => {
    const log = () => { };

    try {
        const userId = Number(req.user.userId);
        log(`>>> Request for UserID: ${userId}`);

        const parent = await prisma.parent.findUnique({
            where: { userId: userId },
            include: {
                student: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (!parent) {
            log(`Parent record NOT found for UserID: ${userId}`);
            return res.status(404).json({ error: 'Parent not found' });
        }

        log(`Parent found: ID ${parent.id}, SchoolID ${parent.schoolId}, Student Count: ${parent.student?.length || 0}`);

        const alerts = [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const lookbackDate = thirtyDaysAgo; // Unified 30-day lookback for all notices

        for (const child of parent.student) {
            // 1. Attendance Today
            try {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);

                const attendance = await prisma.attendance.findMany({
                    where: {
                        studentId: child.id,
                        date: { gte: todayStart, lte: todayEnd }
                    }
                });

                if (attendance.length > 0) {
                    const status = attendance[0].status;
                    let msg = "";
                    const name = child.user?.firstName || child.firstName;
                    if (status === 'P') msg = `${name} is Present today.`;
                    else if (status === 'A') msg = `${name} is Absent today.`;
                    else if (status === 'H') msg = `Today is a Holiday for ${name}.`;
                    else if (status === 'S') msg = `${name}'s attendance was skipped today.`;

                    if (msg) {
                        alerts.push({
                            type: 'ATTENDANCE',
                            message: msg,
                            studentId: child.id,
                            status,
                            createdAt: new Date()
                        });
                        log(`[ATTENDANCE] Added alert for student ${child.id}`);
                    }
                }
            } catch (attErr) {
                log(`[ATTENDANCE ERROR] Student ${child.id}: ${attErr.message}`);
            }

            // 2. New Feedback Reports
            try {
                const feedbacks = await prisma.feedback.findMany({
                    where: {
                        studentId: child.id,
                        createdAt: { gte: lookbackDate }
                    }
                });
                for (const f of feedbacks) {
                    alerts.push({
                        type: 'FEEDBACK',
                        message: `New feedback report available for ${child.user?.firstName || child.firstName}.`,
                        id: f.id,
                        studentId: child.id,
                        createdAt: f.createdAt
                    });
                }
                if (feedbacks.length > 0) log(`[FEEDBACK] Added ${feedbacks.length} alerts for student ${child.id}`);
            } catch (fbErr) {
                log(`[FEEDBACK ERROR] Student ${child.id}: ${fbErr.message}`);
            }

            // 3. New Complaints (Teacher Messages)
            try {
                const complaints = await prisma.teachermessage.findMany({
                    where: {
                        studentId: child.id,
                        parentId: parent.id,
                        createdAt: { gte: lookbackDate }
                    }
                });
                for (const c of complaints) {
                    alerts.push({
                        type: 'COMPLAINT',
                        message: `New official notice for ${child.user?.firstName || child.firstName}: ${c.subject}`,
                        subMessage: "Notice sent to your registered email for formal record.",
                        id: c.id,
                        studentId: child.id,
                        createdAt: c.createdAt
                    });
                }
                if (complaints.length > 0) log(`[COMPLAINT] Added ${complaints.length} alerts for student ${child.id}`);
            } catch (compErr) {
                log(`[COMPLAINT ERROR] Student ${child.id}: ${compErr.message}`);
            }
        }

        // 4. Accepted Chat Messages
        try {
            const acceptedChats = await prisma.message.findMany({
                where: {
                    fromUserId: userId,
                    status: 'ACCEPTED',
                    createdAt: { gte: lookbackDate }
                }
            });
            log(`Found ${acceptedChats.length} accepted chats`);
            for (const chat of acceptedChats) {
                alerts.push({
                    type: 'CHAT_APPROVED',
                    message: `Admin accepted your chat: "${chat.subject}"`,
                    id: chat.id,
                    createdAt: chat.createdAt
                });
            }
        } catch (chatErr) {
            log(`[CHAT ERROR]: ${chatErr.message}`);
        }

        // 5. Admin Broadcast & Personal Notices
        try {
            const studentIds = parent.student.map(s => s.id);
            const adminNotices = await prisma.notification.findMany({
                where: {
                    schoolId: parent.schoolId,
                    OR: [
                        { type: 'ADMIN_NOTICE' },
                        { type: 'RESULT_PUBLISHED' },
                        { parentId: parent.id },
                        { studentId: { in: studentIds } }
                    ],
                    createdAt: { gte: thirtyDaysAgo }
                }
            });
            log(`Found ${adminNotices.length} notices for parent ${parent.id} and school ${parent.schoolId}`);

            for (const notice of adminNotices) {
                const noticeType = notice.type === 'RESULT_PUBLISHED' ? 'RESULT_PUBLISHED'
                    : notice.type === 'PROMOTION' ? 'PROMOTION'
                        : notice.type === 'GRADUATION' ? 'GRADUATION'
                            : 'ADMIN_NOTICE';
                alerts.push({
                    type: noticeType,
                    message: notice.message,
                    id: notice.id,
                    studentId: notice.studentId,
                    isPinned: notice.type === 'ADMIN_NOTICE' || notice.type === 'RESULT_PUBLISHED',
                    isGraduation: notice.type === 'GRADUATION',
                    createdAt: notice.createdAt
                });
            }
        } catch (noticeErr) {
            log(`[ADMIN NOTICE ERROR]: ${noticeErr.message}`);
        }

        // Sorting
        const priorityScore = {
            'GRADUATION': 0,
            'ADMIN_NOTICE': 1,
            'PROMOTION': 2,
            'RESULT_PUBLISHED': 3,
            'ATTENDANCE': 4,
            'FEEDBACK': 5,
            'COMPLAINT': 6,
            'CHAT_APPROVED': 7
        };

        alerts.sort((a, b) => {
            if (priorityScore[a.type] !== priorityScore[b.type]) {
                return priorityScore[a.type] - priorityScore[b.type];
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        log(`Final Total alerts returned: ${alerts.length}`);
        res.json({ ok: true, data: alerts });

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}\n${err.stack}`);
        res.status(500).json({
            error: 'Failed to fetch daily briefing',
            details: err.message,
            stack: err.stack
        });
    }
});

// GET Student Monthly Performance (Enhanced with Calendar & Granular Stats)
router.get('/child/:studentId/monthly-performance', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, year, calendar } = req.query;
        const userId = Number(req.user.userId);

        // Verify ownership/link
        const parents = await prisma.parent.findMany({
            where: { userId },
            include: { student: true }
        });
        if (parents.length === 0) return res.status(404).json({ error: "Parent not found" });
        const parent = parents[0];

        const isLinked = parent.student.some(s => s.id === parseInt(studentId));
        if (!isLinked) return res.status(403).json({ error: "Access denied. Student not linked." });

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { school: true, user: true }
        });
        if (!student) return res.status(404).json({ error: "Student not found" });

        const activeYear = parseInt(year) || student.school?.activePerformanceYear || 2026;
        const selectedMonth = parseInt(month);

        // Date Range Logic
        let startDate, endDate;
        if (calendar === 'NEPALI') {
            const nepaliStartMap = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
            const engMonth = nepaliStartMap[selectedMonth] || 3;
            startDate = new Date(activeYear, engMonth, 1);
            endDate = new Date(activeYear, engMonth + 1, 0, 23, 59, 59);
        } else {
            startDate = new Date(activeYear, selectedMonth, 1);
            endDate = new Date(activeYear, selectedMonth + 1, 0, 23, 59, 59);
        }

        // Check Calculation Status
        const termPrefix = student.activePerformanceSession || "1st";
        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: termPrefix.split(' ')[0] },
                status: 'PUBLISHED'
            }
        });
        const isCalculated = publishRecord && publishRecord.calculationStatus === 'COMPLETED';

        // 1. Assignment Summary (Full Month)
        const submissions = await prisma.submission.findMany({
            where: {
                studentId: parseInt(studentId),
                grade: { not: null },
                submittedAt: { gte: startDate, lte: endDate }
            }
        });
        const earnedTotal = submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
        const possibleTotal = (submissions.length * 100);

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
                    total: (presentCount + absentCount)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch monthly performance data" });
    }
});

// GET Child Terminals
router.get('/child/:studentId/terminals', async (req, res) => {
    try {
        const { studentId } = req.params;
        const userId = Number(req.user.userId);

        const parents = await prisma.parent.findMany({
            where: { userId },
            include: { student: { where: { id: parseInt(studentId) } } }
        });
        if (parents.length === 0 || parents[0].student.length === 0) {
            return res.status(403).json({ error: "Access denied" });
        }

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            select: { schoolId: true }
        });

        const publishedTerminals = await prisma.schoolexampublish.findMany({
            where: {
                schoolId: student.schoolId,
                status: 'PUBLISHED'
            },
            select: { examTerminal: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' }
        });

        res.json({ ok: true, data: publishedTerminals.map(p => ({ terminal: p.examTerminal, publishedAt: p.publishedAt })) });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch terminals" });
    }
});

// GET Tooltip Terminal Marks for Child
router.get('/child/:studentId/terminal-marks', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { terminal } = req.query;
        const userId = Number(req.user.userId);

        const parents = await prisma.parent.findMany({
            where: { userId },
            include: { student: { where: { id: parseInt(studentId) } } }
        });
        if (parents.length === 0 || parents[0].student.length === 0) {
            return res.status(403).json({ error: "Access denied" });
        }

        if (!terminal) return res.status(400).json({ error: "Terminal required" });

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            select: { schoolId: true }
        });

        // Remove mandatory publish check as per user request for immediate visibility
        // But still fetch the record if it exists to know if it IS published/calculated for UI purposes
        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: terminal.split(' ')[0] }
            }
        });

        const prefix = terminal.split(' ')[0];
        const marks = await prisma.exammark.findMany({
            where: {
                studentId: parseInt(studentId),
                examTerminal: { startsWith: prefix }
            },
            include: { subject: true }
        });

        const results = marks.map(m => ({
            subject: m.subject?.name || "Unknown",
            marks: m.marks,
            fullMarks: m.fullMarks || 100,
            passMarks: m.passMarks || 40
        }));

        const totalObtained = results.reduce((acc, curr) => acc + curr.marks, 0);
        const totalFull = results.reduce((acc, curr) => acc + curr.fullMarks, 0);
        const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;

        res.json({
            ok: true,
            data: {
                terminal,
                results,
                totalObtained,
                totalFull,
                percentage: percentage.toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch terminal marks" });
    }
});

router.get('/student/:studentId/grade-sheet/:terminal', async (req, res) => {
    try {
        const { studentId, terminal } = req.params;
        const userId = Number(req.user.userId);

        // 1. Verify parent-student linkage
        const parent = await prisma.parent.findUnique({
            where: { userId: userId },
            include: { student: { where: { id: parseInt(studentId) } } }
        });

        if (!parent || parent.student.length === 0) {
            return res.status(403).json({ error: "Access denied. Student not linked to this parent." });
        }

        const linkedStudent = await prisma.student.findUnique({ where: { id: parseInt(studentId) }, select: { schoolId: true } });
        const schoolId = linkedStudent.schoolId;

        // 2. Verify publication (bypassed for parent dashboard term filter)
        const prefix = terminal.split(' ')[0];
        const publishInfo = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: schoolId,
                examTerminal: { startsWith: prefix }
            }
        });

        // if (!publishInfo) {
        //     return res.status(403).json({ error: "Results for this terminal are not yet published." });
        // }

        // 3. Fetch comprehensive details
        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { Renamedclass: true, user: true }
        });

        const marks = await prisma.exammark.findMany({
            where: {
                studentId: parseInt(studentId),
                examTerminal: { startsWith: prefix }
            },
            include: { subject: true },
            orderBy: { subject: { name: 'asc' } }
        });

        const school = await prisma.school.findUnique({ where: { id: schoolId } });

        const totalObtained = marks.reduce((s, m) => s + (m.marks || 0), 0);
        const totalFull = marks.reduce((s, m) => s + (m.fullMarks || 100), 0);
        const hasFail = marks.some(m => m.status === 'FAILED');
        const overallPct = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
        const overallGrade = getGradeFromMarks(totalObtained, totalFull);

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
                school: {
                    name: school?.name,
                    address: school?.address,
                    phone: school?.phone,
                    email: school?.email
                },
                terminal,
                marks: marks.map(m => {
                    const pct = m.fullMarks > 0 ? (m.marks / m.fullMarks) * 100 : 0;
                    const gradeInfo = getGradeFromMarks(m.marks || 0, m.fullMarks || 100);
                    return {
                        subject: m.subject?.name || 'Unknown',
                        theory: m.theoryMarks,
                        theoryfull: m.theoryFullMarks,
                        theorypass: m.theoryPassMarks,
                        practical: m.practicalMarks,
                        practicalfull: m.practicalFullMarks,
                        practicalpass: m.practicalPassMarks,
                        total: m.marks,
                        full: m.fullMarks,
                        pass: m.passMarks,
                        percentage: Math.round(pct * 10) / 10,
                        grade: gradeInfo.grade,
                        gpa: gradeInfo.gpa,
                        status: m.status
                    };
                }),
                totalObtained,
                totalFull,
                percentage: overallPct.toFixed(1),
                overallGrade: overallGrade.grade,
                overallGPA: overallGrade.gpa,
                overallDescription: overallGrade.description,
                overallStatus: marks.length === 0 ? 'PENDING' : hasFail ? 'FAIL' : 'PASS'
            }
        });

    } catch (err) {
        res.status(500).json({ error: "Failed to fetch grade sheet data" });
    }
});

// GET /child/:studentId/attendance — Attendance report for parent
router.get('/child/:studentId/attendance', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, year } = req.query;
        const userId = Number(req.user.userId);

        // Verify parent-student link
        const parent = await prisma.parent.findUnique({
            where: { userId },
            include: { student: { where: { id: parseInt(studentId) } } }
        });
        if (!parent || parent.student.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { Renamedclass: true }
        });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Build date filter
        const where = { studentId: parseInt(studentId) };
        if (month && year) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
            where.date = { gte: startDate, lte: endDate };
        } else if (year) {
            const startDate = new Date(parseInt(year), 0, 1);
            const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
            where.date = { gte: startDate, lte: endDate };
        }

        const records = await prisma.attendance.findMany({
            where,
            orderBy: { date: 'desc' },
            select: { id: true, date: true, status: true }
        });

        const total = records.length;
        const present = records.filter(r => r.status === 'P').length;
        const absent = records.filter(r => r.status === 'A').length;
        const late = records.filter(r => r.status === 'L').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        // Group by month for chart
        const monthlyData = {};
        records.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[key]) monthlyData[key] = { total: 0, present: 0, absent: 0, late: 0 };
            monthlyData[key].total++;
            if (r.status === 'P') monthlyData[key].present++;
            else if (r.status === 'A') monthlyData[key].absent++;
            else if (r.status === 'L') monthlyData[key].late++;
        });

        const monthly = Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, data]) => ({
                month: key,
                label: new Date(key + '-01').toLocaleString('default', { month: 'short', year: 'numeric' }),
                ...data,
                percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
            }));

        res.json({
            ok: true,
            data: {
                student: { name: `${student.firstName} ${student.lastName}`, className: `${student.Renamedclass?.name || ''}${student.Renamedclass?.section || ''}` },
                summary: { total, present, absent, late, percentage },
                monthly,
                records: records.map(r => ({ date: r.date, status: r.status }))
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

module.exports = router;

