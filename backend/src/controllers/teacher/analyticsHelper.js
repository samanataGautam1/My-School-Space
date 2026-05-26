const { PrismaClient } = require('@prisma/client');
const path = require('path');
const prisma = new PrismaClient();
const { getSessionDateRange } = require(path.join(__dirname, '../admin/sessionDates'));
const { calculatePerformance } = require('../../utils/performanceCalculator');
const { calculatePotential } = require('../../utils/potentialCalculator');

// Single source of truth for the decimal precision of headline scores
// (performanceTotal / potentialTotal) returned by every dashboard API.
// Frontends render the value as-is so teacher and parent always agree.
const round1 = (x) => Number(((+x) || 0).toFixed(1));

// ─────────────────────────────────────────────────────────────────────────────
//  PDF-COMPLIANT FORMULAS
//
//  PERFORMANCE (X-axis):
//    Exam       (50% weight): (avgExamPct − 50) × 0.5          → ±25
//    Assignment (30% weight): sum(each_grade − 50) × 0.3        → variable
//    Attendance (20% weight): ((P − A) / activeDays) × 20       → ±20
//
//  POTENTIAL (Y-axis):
//    Effort (40 pts):
//      Assignment submission (20): ((onTime − late − missed) / total) × 20
//      Materials watching    (20): ((onTimeWatched − lateWatched) / total) × 20
//    Curiosity (40 pts):
//      Quiz questions  (30): ((solved − notSolved) / total) × 30
//      Teacher MCQ     (10): manual input 0-10
//    Learning Speed (20 pts): ((correct − incorrect − missed) / total) × 20
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates effort score (0–40 pts) using PDF formulas.
 * Uses potentialCalculator functions for the math.
 * Returns { total, breakdown } for backward compatibility with callers.
 */
async function calculateEffortPercentage(studentId, classId, startDate, endDate) {
    const studentIdInt = parseInt(studentId);
    const classIdInt = parseInt(classId);

    if (isNaN(studentIdInt) || isNaN(classIdInt)) {
        return { total: 0, breakdown: { assignments: 0, materials: 0, onTime: 0, late: 0, missed: 0, totalAssign: 0 } };
    }

    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const now = new Date();

    // Fetch assignments
    let assignments = await prisma.assignment.findMany({
        where: { classId: classIdInt, dueDate: { gte: startObj, lte: endObj } }
    });
    if (assignments.length === 0) {
        assignments = await prisma.assignment.findMany({ where: { classId: classIdInt } });
    }
    const assignmentIds = assignments.map(a => a.id);

    // Fetch submissions
    const submissions = assignmentIds.length > 0 ? await prisma.submission.findMany({
        where: { studentId: studentIdInt, assignmentId: { in: assignmentIds } }
    }) : [];

    // Count on-time / late / missed
    const submissionMap = new Map(submissions.map(s => [s.assignmentId, s]));
    let onTime = 0, late = 0, missed = 0;
    for (const asg of assignments) {
        const sub = submissionMap.get(asg.id);
        if (!sub) {
            if (now > new Date(asg.dueDate)) missed++;
        } else if (asg.dueDate && sub.submittedAt && new Date(sub.submittedAt) > new Date(asg.dueDate)) {
            late++;
        } else {
            onTime++;
        }
    }

    // PDF formula: ((onTime - late - missed) / total) * 20
    const totalAssign = assignments.length;
    const assignmentEffort = totalAssign > 0
        ? parseFloat((((onTime - late - missed) / totalAssign) * 20).toFixed(2))
        : 0;

    // Fetch materials and progress
    let materials = await prisma.studymaterial.findMany({
        where: { classId: classIdInt, deadline: { gte: startObj, lte: endObj } }
    });
    if (materials.length === 0) {
        materials = await prisma.studymaterial.findMany({ where: { classId: classIdInt } });
    }
    const materialIds = materials.map(m => m.id);
    const progressRecords = materialIds.length > 0 ? await prisma.studentmaterialstatus.findMany({
        where: { studentId: studentIdInt, studyMaterialId: { in: materialIds } }
    }) : [];
    const progressMap = new Map(progressRecords.map(p => [p.studyMaterialId, p]));

    let onTimeWatched = 0, lateWatched = 0;
    for (const mat of materials) {
        const prog = progressMap.get(mat.id);
        if (!prog || prog.status !== 'COMPLETED') continue;
        if (mat.deadline && prog.completedAt) {
            if (new Date(prog.completedAt) <= new Date(mat.deadline)) {
                onTimeWatched++;
            } else {
                lateWatched++;
            }
        } else {
            onTimeWatched++;
        }
    }

    // PDF formula: ((onTimeWatched - lateWatched) / total) * 20
    const totalMat = materials.length;
    const materialEffort = totalMat > 0
        ? parseFloat((((onTimeWatched - lateWatched) / totalMat) * 20).toFixed(2))
        : 0;

    const total = parseFloat((assignmentEffort + materialEffort).toFixed(2));

    return {
        total,
        breakdown: {
            assignments: assignmentEffort,
            materials: materialEffort,
            onTime,
            late,
            missed,
            totalAssign
        }
    };
}

/**
 * Main analytics function — calculates Performance + Potential for a student.
 * Uses performanceCalculator.js + potentialCalculator.js (PDF-compliant formulas).
 * Falls back to stored potentialmetric data if session is finalized.
 */
async function calculateStudentMetrics(studentId, classId, startDate, endDate, session, year) {
    const studentIdInt = parseInt(studentId);
    const classIdInt = parseInt(classId) || 0;
    const yearInt = parseInt(year);

    if (isNaN(studentIdInt)) {
        throw new Error("Invalid studentId provided to analytics helper");
    }

    const studentInfo = await prisma.student.findUnique({
        where: { id: studentIdInt },
        select: { schoolId: true }
    });
    if (!studentInfo) throw new Error("Student not found");

    let startObj = new Date(startDate);
    let endObj = new Date(endDate);
    const termPrefix = (session || "1st").split(' ')[0];

    // Smart date range: expand to full year if no data in session range
    const hasAssignData = await prisma.assignment.count({
        where: { classId: classIdInt, dueDate: { gte: startObj, lte: endObj } }
    });
    const hasAttendData = await prisma.attendance.count({
        where: { studentId: studentIdInt, date: { gte: startObj, lte: endObj } }
    });
    if (hasAssignData === 0 && hasAttendData === 0) {
        startObj = new Date(yearInt, 0, 1);
        endObj = new Date(yearInt, 11, 31, 23, 59, 59, 999);
    }

    // Check if session is finalized
    const publishRecord = await prisma.schoolexampublish.findFirst({
        where: { schoolId: studentInfo.schoolId, examTerminal: { startsWith: termPrefix } },
        orderBy: { publishedAt: 'desc' }
    });
    const isCalculated = publishRecord &&
        (publishRecord.calculationStatus === 'COMPLETED' || publishRecord.status === 'PUBLISHED');

    // Stored potential metric
    const pm = await prisma.potentialmetric.findFirst({
        where: { studentId: studentIdInt, session: session || "1st Session", sessionYear: yearInt },
        orderBy: { createdAt: 'desc' }
    });

    // ══════════════════════════════════════════════════════════════════════
    //  FETCH ALL RAW DATA
    // ══════════════════════════════════════════════════════════════════════

    // 1. Exam marks for this terminal
    const examMarks = await prisma.exammark.findMany({
        where: { studentId: studentIdInt, examTerminal: { startsWith: termPrefix } }
    });

    // 2. Assignments and submissions
    let assignments = await prisma.assignment.findMany({
        where: { classId: classIdInt, dueDate: { gte: startObj, lte: endObj } }
    });
    if (assignments.length === 0) {
        assignments = await prisma.assignment.findMany({ where: { classId: classIdInt } });
    }
    const assignmentIds = assignments.map(a => a.id);

    const gradedSubmissions = assignmentIds.length > 0 ? await prisma.submission.findMany({
        where: { studentId: studentIdInt, assignmentId: { in: assignmentIds }, grade: { not: null } }
    }) : [];

    const allSubmissions = assignmentIds.length > 0 ? await prisma.submission.findMany({
        where: { studentId: studentIdInt, assignmentId: { in: assignmentIds } }
    }) : [];

    // 3. Attendance
    let attendanceRecords = await prisma.attendance.findMany({
        where: { studentId: studentIdInt, date: { gte: startObj, lte: endObj } }
    });
    if (attendanceRecords.length === 0) {
        attendanceRecords = await prisma.attendance.findMany({ where: { studentId: studentIdInt } });
    }
    const totalSchoolDays = attendanceRecords.length;

    // 4. Study materials and progress
    let materials = await prisma.studymaterial.findMany({
        where: { classId: classIdInt, deadline: { gte: startObj, lte: endObj } }
    });
    if (materials.length === 0) {
        materials = await prisma.studymaterial.findMany({ where: { classId: classIdInt } });
    }
    const materialIds = materials.map(m => m.id);

    const progressRecords = materialIds.length > 0 ? await prisma.studentmaterialstatus.findMany({
        where: { studentId: studentIdInt, studyMaterialId: { in: materialIds } }
    }) : [];

    // 5. Quiz data
    const quizSets = materialIds.length > 0 ? await prisma.quizset.findMany({
        where: { studyMaterialId: { in: materialIds } },
        include: { questions: { select: { id: true } } }
    }) : [];

    const allQuestionIds = [];
    quizSets.forEach(qs => qs.questions.forEach(q => allQuestionIds.push(q.id)));
    const totalQuestions = allQuestionIds.length;

    const quizResponses = totalQuestions > 0 ? await prisma.quizresponse.findMany({
        where: { studentId: studentIdInt, questionId: { in: allQuestionIds } }
    }) : [];

    const totalSolved = quizResponses.length;
    const correctAnswers = quizResponses.filter(r => r.isCorrect === true).length;
    const incorrectAnswers = quizResponses.filter(r => r.isCorrect === false).length;

    // ══════════════════════════════════════════════════════════════════════
    //  CALCULATE USING PDF FORMULAS (via calculator utils)
    // ══════════════════════════════════════════════════════════════════════

    const perf = calculatePerformance(examMarks, gradedSubmissions, attendanceRecords, totalSchoolDays);
    const pot = calculatePotential(
        assignments, allSubmissions, materials, progressRecords,
        totalQuestions, totalSolved, correctAnswers, incorrectAnswers
    );

    // Effort breakdown counts (for display)
    const now = new Date();
    const submissionMap = new Map(allSubmissions.map(s => [s.assignmentId, s]));
    let onTime = 0, late = 0, missed = 0;
    for (const asg of assignments) {
        const sub = submissionMap.get(asg.id);
        if (!sub) {
            if (now > new Date(asg.dueDate)) missed++;
        } else if (asg.dueDate && sub.submittedAt && new Date(sub.submittedAt) > new Date(asg.dueDate)) {
            late++;
        } else {
            onTime++;
        }
    }

    // Display strings
    let examDisplay = '—', assignDisplay = '—', attDisplay = '—';
    if (examMarks.length > 0) {
        const totalObtained = examMarks.reduce((s, m) => s + (m.marks || 0), 0);
        const totalFull = examMarks.reduce((s, m) => s + (m.fullMarks || 100), 0);
        examDisplay = `${Math.round((totalObtained / totalFull) * 100)}%`;
    }
    if (gradedSubmissions.length > 0) {
        const avgGrade = gradedSubmissions.reduce((s, sub) => s + (sub.grade || 0), 0) / gradedSubmissions.length;
        assignDisplay = `${Math.round(avgGrade)}%`;
    }
    if (totalSchoolDays > 0) {
        const presentDays = attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'P' || a.status === 'L').length;
        attDisplay = `${Math.round((presentDays / totalSchoolDays) * 100)}%`;
    }

    // Curiosity MCQ from stored metric (teacher fills in later)
    const curiosityMcq = pm?.curiosityMcq ?? 0;
    const curiosityTotal = parseFloat((pot.curiosityQuiz + curiosityMcq).toFixed(2));
    const potentialTotal = parseFloat((pot.effortTotal + curiosityTotal + pot.learningSpeed).toFixed(2));

    // ══════════════════════════════════════════════════════════════════════
    //  BUILD RESPONSE — unified shape for all callers
    // ══════════════════════════════════════════════════════════════════════

    function buildResponse(perfData, potData, cMcq, cTotal, pTotal, isDone) {
        const perfRounded = round1(perfData.performanceTotal);
        const potRounded = round1(pTotal);
        return {
            performance: perfRounded,
            finalPerformance: perfRounded,
            exam: { value: perfData.examScore, display: examDisplay },
            assignment: { value: perfData.assignmentScore, display: assignDisplay },
            attendance: { value: perfData.attendanceScore, display: attDisplay },
            potential: {
                total: potRounded,
                effort: { value: potData.effortTotal, display: `${potData.effortTotal} / 40` },
                curiosity: { value: cTotal, display: `${cTotal} / 40` },
                learningSpeed: { value: potData.learningSpeed, display: `${potData.learningSpeed} / 20` },
                effortBreakdown: {
                    assignments: potData.effortAssignment,
                    materials: potData.effortMaterials,
                    onTime, late, missed, totalAssign: assignments.length
                }
            },
            effort: {
                total: potData.effortTotal,
                breakdown: {
                    assignments: potData.effortAssignment,
                    materials: potData.effortMaterials,
                    onTime, late, missed, totalAssign: assignments.length
                }
            },
            curiosity: cTotal,
            learningSpeed: potData.learningSpeed,
            finalPotential: potRounded,
            finalY: potRounded,
            potentialBreakdown: {
                effort: potData.effortTotal,
                curiosity: cTotal,
                learningSpeed: potData.learningSpeed,
                effortAssignment: potData.effortAssignment,
                effortMaterials: potData.effortMaterials,
                effortTotal: potData.effortTotal,
                curiosityQuiz: potData.curiosityQuiz,
                curiosityMcq: cMcq,
                curiosityTotal: cTotal,
                onTime, late, missed, totalAssign: assignments.length
            },
            percentage: { potentialAvg: potRounded },
            student: { finalX: perfRounded, finalY: potRounded },
            activeSession: { session: session || "1st Session", isDone: isDone }
        };
    }

    // ── Use STORED values if session is finalized ────────────────────────
    if (isCalculated && pm && pm.performanceTotal != null) {
        const storedPerf = {
            examScore: pm.examScore || 0,
            assignmentScore: pm.assignmentScore || 0,
            attendanceScore: pm.attendanceScore || 0,
            performanceTotal: pm.performanceTotal || 0
        };
        const storedPot = {
            effortAssignment: pm.effortAssignment || 0,
            effortMaterials: pm.effortMaterials || 0,
            effortTotal: pm.effortTotal || 0,
            curiosityQuiz: pm.curiosityQuiz || 0,
            learningSpeed: pm.learningSpeed || 0
        };
        const storedMcq = pm.curiosityMcq ?? 0;
        const storedCTotal = pm.curiosityTotal ?? parseFloat(((pm.curiosityQuiz || 0) + storedMcq).toFixed(2));
        const storedPTotal = pm.potentialTotal ?? parseFloat(((pm.effortTotal || 0) + storedCTotal + (pm.learningSpeed || 0)).toFixed(2));

        return buildResponse(storedPerf, storedPot, storedMcq, storedCTotal, storedPTotal, true);
    }

    // ── Live calculation ─────────────────────────────────────────────────
    return buildResponse(perf, pot, curiosityMcq, curiosityTotal, potentialTotal, false);
}

/**
 * Class baselines from stored potentialmetric records.
 */
async function getClassBaselines(classId, session, year) {
    const classIdInt = parseInt(classId);
    if (isNaN(classIdInt)) return { effortBaseline: 0, curiosityBaseline: 0, learningSpeedBaseline: 0 };

    const students = await prisma.student.findMany({ where: { classId: classIdInt, isApproved: true } });
    if (students.length === 0) return { effortBaseline: 0, curiosityBaseline: 0, learningSpeedBaseline: 0 };

    const metrics = await prisma.potentialmetric.findMany({
        where: { studentId: { in: students.map(s => s.id) }, session, sessionYear: parseInt(year) }
    });

    if (metrics.length === 0) return { effortBaseline: 0, curiosityBaseline: 0, learningSpeedBaseline: 0 };

    let tE = 0, tC = 0, tL = 0;
    metrics.forEach(m => {
        tE += (m.effortTotal || m.effort || 0);
        tC += (m.curiosityTotal || m.curiosityQuiz || 0);
        tL += (m.learningSpeed || 0);
    });

    return {
        effortBaseline: Math.round((tE / metrics.length) * 100) / 100,
        curiosityBaseline: Math.round((tC / metrics.length) * 100) / 100,
        learningSpeedBaseline: Math.round((tL / metrics.length) * 100) / 100
    };
}

module.exports = {
    calculateStudentMetrics,
    calculateEffortPercentage,
    getClassBaselines
};
