const prisma = require("../../../prisma/prisma");
const path = require('path');

const { getSessionDateRange, getNextSession } = require(path.join(__dirname, '../admin/sessionDates'));

/**
 * Updates a student's accumulated assignment performance in the potentialmetric table.
 * Logic: (score - 40) added to teacherMarks.
 * If session is locked, data goes to the next session.
 */
async function updateStudentAssignmentPerformance(studentId, score, isMissed = false) {
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
            school: true,
            potentialmetric: true // Get all, we'll filter in JS
        }
    });

    if (!student || !student.school) return;

    let session = student.school.activePerformanceSession || "1st Session";
    let year = student.school.activePerformanceYear || 2026;

    // Check if the current session is locked (CALCULATED)
    const publishRecord = await prisma.schoolexampublish.findFirst({
        where: {
            schoolId: student.schoolId,
            examTerminal: { startsWith: session.split(' ')[0] },
            calculationStatus: 'COMPLETED'
        }
    });

    // If locked, we move to the next session for this specific student's record
    if (publishRecord) {
        const next = getNextSession(session, year);
        session = next.nextSession;
        year = next.nextYear;
    }

    const existingMetric = student.potentialmetric.find(pm => pm.session === session && pm.sessionYear === year);

    const delta = isMissed ? -100 : Math.max(-100, Math.min(100, score - 50));

    await prisma.potentialmetric.upsert({
        where: {
            studentId_session_sessionYear: {
                studentId: studentId,
                session: session,
                sessionYear: year
            }
        },
        update: {
            teacherMarks: (!existingMetric || existingMetric.teacherMarks === null)
                ? delta
                : { increment: delta }
        },
        create: {
            studentId: studentId,
            session: session,
            sessionYear: year,
            monthYear: new Date().toISOString().substring(0, 7),
            teacherMarks: delta,
            effort: 0,
            curiosity: 0,
            learningSpeed: 0
        }
    });
}

/**
 * Calculates a student's Effort score based on:
 * 1. Assignment Timeliness (10%): (On-time - Late) * 0.1
 * 2. Study Material Completion (15%): (On-time - Penalty) * 0.15
 * 3. Quiz Resolution (15%): (Solved - Skipped) * 0.15
 */
async function calculateStudentEffort(studentId, classId, startDate, endDate) {
    // 1. Assignment Timeliness
    const assignments = await prisma.assignment.findMany({
        where: { classId, createdAt: { gte: startDate, lte: endDate } },
        select: { id: true, dueDate: true }
    });

    let onTimeAsgn = 0;
    let lateAsgn = 0;

    for (const a of assignments) {
        const sub = await prisma.submission.findFirst({
            where: { assignmentId: a.id, studentId }
        });

        if (sub && sub.submittedAt <= (a.dueDate || sub.submittedAt)) {
            onTimeAsgn++;
        } else {
            lateAsgn++;
        }
    }
    const asgnEffort = (onTimeAsgn - lateAsgn) * 0.1;

    // 2. Study Material Completion
    const materials = await prisma.studymaterial.findMany({
        where: { classId, createdAt: { gte: startDate, lte: endDate } },
        select: { id: true, deadline: true }
    });

    let onTimeMat = 0;
    let penaltyMat = 0;

    for (const m of materials) {
        const status = await prisma.studentmaterialstatus.findUnique({
            where: { studentId_studyMaterialId: { studentId, studyMaterialId: m.id } }
        });

        if (status && status.status === 'COMPLETED' && status.completedAt <= (m.deadline || status.completedAt)) {
            onTimeMat++;
        } else {
            penaltyMat++;
        }
    }
    const matEffort = (onTimeMat - penaltyMat) * 0.15;

    // 3. Quiz Resolution
    // Find all questions associated with these materials
    const questions = await prisma.question.findMany({
        where: {
            quizset: {
                studymaterial: {
                    classId,
                    createdAt: { gte: startDate, lte: endDate }
                }
            }
        },
        select: { id: true }
    });

    let solvedQuizzes = 0;
    let skippedQuizzes = 0;

    for (const q of questions) {
        const resp = await prisma.quizresponse.findUnique({
            where: { studentId_questionId: { studentId, questionId: q.id } }
        });

        if (resp && resp.answer && resp.answer.trim() !== "") {
            solvedQuizzes++;
        } else {
            skippedQuizzes++;
        }
    }
    const quizEffort = (solvedQuizzes - skippedQuizzes) * 0.15;

    const totalSum = asgnEffort + matEffort + quizEffort;
    return Number(totalSum.toFixed(2));
}

const { calculateStudentMetrics } = require('./analyticsHelper');

/**
 * Finds all assignments in a session that a student missed and applies a -100 penalty.
 * Called when admin clicks "Run Calculation".
 */
async function finalizeSessionAssignments(schoolId, session, year) {
    const { startDate, endDate } = getSessionDateRange(session, year);

    // Get all students in this school
    const students = await prisma.student.findMany({
        where: { schoolId, isApproved: true },
        select: { id: true, classId: true }
    });

    for (const student of students) {
        if (!student.classId) continue;

        try {
            // Use the unified analytics helper to get all metrics
            const metrics = await calculateStudentMetrics(
                student.id,
                student.classId,
                startDate,
                endDate,
                session,
                year
            );

            // Store metrics in both new and legacy fields
            const effortTotal = metrics.effort?.total ?? 0;
            const lsValue = metrics.learningSpeed ?? 0;
            const examValue = metrics.exam?.value ?? 0;
            const assignValue = metrics.assignment?.value ?? 0;
            const attValue = metrics.attendance?.value ?? 0;
            const perfTotal = metrics.performance ?? metrics.finalPerformance ?? 0;
            const effortAssign = metrics.potentialBreakdown?.effortAssignment ?? 0;
            const effortMat = metrics.potentialBreakdown?.effortMaterials ?? 0;
            const curiosityQuiz = metrics.potentialBreakdown?.curiosityQuiz ?? 0;

            await prisma.potentialmetric.upsert({
                where: {
                    studentId_session_sessionYear: {
                        studentId: student.id,
                        session: session,
                        sessionYear: year
                    }
                },
                update: {
                    // New fields
                    examScore: examValue,
                    assignmentScore: assignValue,
                    attendanceScore: attValue,
                    performanceTotal: perfTotal,
                    effortAssignment: effortAssign,
                    effortMaterials: effortMat,
                    effortTotal: effortTotal,
                    curiosityQuiz: curiosityQuiz,
                    learningSpeed: lsValue,
                    // Legacy fields
                    effort: effortTotal,
                    teacherMarks: assignValue,
                    examDeviation: examValue,
                    attendanceDeviation: attValue,
                    monthYear: new Date().toISOString().substring(0, 7)
                },
                create: {
                    studentId: student.id,
                    session: session,
                    sessionYear: year,
                    monthYear: new Date().toISOString().substring(0, 7),
                    // New fields
                    examScore: examValue,
                    assignmentScore: assignValue,
                    attendanceScore: attValue,
                    performanceTotal: perfTotal,
                    effortAssignment: effortAssign,
                    effortMaterials: effortMat,
                    effortTotal: effortTotal,
                    curiosityQuiz: curiosityQuiz,
                    learningSpeed: lsValue,
                    // Legacy fields
                    effort: effortTotal,
                    curiosity: 0,
                    teacherMarks: assignValue,
                    examDeviation: examValue,
                    attendanceDeviation: attValue
                }
            });
        } catch (err) {
            console.error(`Error calculating metrics for student ${student.id}:`, err);
        }
    }
}

module.exports = {
    updateStudentAssignmentPerformance,
    finalizeSessionAssignments
};
