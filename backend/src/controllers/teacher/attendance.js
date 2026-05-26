const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, allowRoles } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Only teachers can access these routes
router.use(authMiddleware, allowRoles('TEACHER'));

router.use((req, res, next) => {
    console.log("[AttendanceRouter] Request:", req.method, req.path, req.params);
    next();
});

router.get('/classes', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const teacher = await prisma.teacher.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        if (!teacher) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }

        // Fetch classes where the teacher is the Class Head
        const headClasses = await prisma.renamedclass.findMany({
            where: { 
                classHeadId: teacher.id 
            }
        });

        // Fetch classes where the teacher is assigned via Renamedclassteacher
        const assignedClasses = await prisma.renamedclass.findMany({
            where: {
                teacher_classteachers: {
                    some: {
                        id: teacher.id
                    }
                }
            }
        });

        // Merge and deduplicate classes
        const classMap = new Map();
        [...headClasses, ...assignedClasses].forEach(cls => {
            classMap.set(cls.id, cls);
        });

        const distinctClasses = Array.from(classMap.values())
            .sort((a, b) => {
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                return a.section.localeCompare(b.section);
            });

        res.json({ ok: true, data: distinctClasses });
    } catch (error) {
        console.error("Fetch available classes error:", error);
        res.status(500).json({ error: "Failed to fetch classes" });
    }
});

/**
 * Helper to verify if a teacher is authorized for a class
 */
async function isAuthorizedForClass(teacherId, classId) {
    const cls = await prisma.renamedclass.findUnique({
        where: { id: Number(classId) },
        include: {
            teacher_classteachers: {
                where: { id: Number(teacherId) }
            }
        }
    });

    if (!cls) return false;

    // Authorized if Class Head OR explicitly assigned as a teacher
    const isHead = cls.classHeadId === Number(teacherId);
    const isAssigned = cls.teacher_classteachers.length > 0;

    return isHead || isAssigned;
}

/**
 * GET /students/:classId
 * Fetch students for a specific class. 
 * Verifies if the requesting teacher is the class head.
 */
router.get('/students/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = Number(req.user.userId);
        console.log(`[AttendanceRouter] Fetching students for class ${classId}, userId ${userId}`);

        // Normalize today's date to UTC 00:00:00
        const today = new Date(new Date().toISOString().split('T')[0]);

        // Verify teacher belongs to the same school as the class
        const teacher = await prisma.teacher.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        if (!teacher) {
            console.log("[AttendanceRouter] Teacher profile not found for userId", userId);
            return res.status(404).json({ error: "Teacher profile not found" });
        }

        const isAuthorized = await isAuthorizedForClass(teacher.id, classId);
        if (!isAuthorized) {
            console.log("[AttendanceRouter] Access denied. Teacher ID:", teacher.id, "not authorized for Class ID:", classId);
            return res.status(403).json({ error: "Access denied: You are not authorized for this class" });
        }

        const students = await prisma.student.findMany({
            where: { 
                classId: parseInt(classId),
                isApproved: true
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                attendance: { // Corrected from 'attendances'
                    where: {
                        date: today
                    }
                }
            },
            orderBy: { rollNo: 'asc' }
        });

        console.log(`[AttendanceRouter] Found ${students.length} students for class ${classId}`);
        res.json({ ok: true, data: students });
    } catch (error) {
        console.error("Fetch students for attendance error:", error);
        res.status(500).json({ error: "Failed to fetch students" });
    }
});

/**
 * GET /history/:classId
 * Fetch attendance history with filters.
 * Query params: year, month (1-12)
 */
router.get('/history/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { year, month, view } = req.query;
        const userId = Number(req.user.userId);

        const now = new Date();
        const currentYearValue = now.getFullYear();
        const currentMonthValue = now.getMonth() + 1;

        const targetYear = parseInt(year) || currentYearValue;
        const targetMonth = parseInt(month) || currentMonthValue; // Default to current month if not provided

        // Requirement: Only current year history is available
        if (targetYear !== currentYearValue) {
            return res.status(400).json({ error: `Only attendance history for the current year (${currentYearValue}) is available.` });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        if (!teacher) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }

        const isAuthorized = await isAuthorizedForClass(teacher.id, classId);
        if (!isAuthorized) {
            return res.status(403).json({ error: "Access denied: Unauthorized to view history for this class" });
        }

        const isCurrentMonth = (targetMonth === currentMonthValue) && (targetYear === currentYearValue);
        const returnSummary = view === 'summary' || (!view && !isCurrentMonth);

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        const records = await prisma.attendance.findMany({
            where: {
                classId: parseInt(classId),
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                student: {
                    include: {
                        user: {
                            select: { firstName: true, lastName: true }
                        }
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        if (!returnSummary) {
            // Return detailed records for current month
            return res.json({
                ok: true,
                type: 'detailed',
                data: records
            });
        } else {
            // Return aggregated summary for past months
            const aggregated = {};
            records.forEach(record => {
                const studentName = `${record.student.user.firstName} ${record.student.user.lastName}`;
                if (!aggregated[studentName]) {
                    aggregated[studentName] = {
                        studentId: record.studentId,
                        studentName,
                        rollNo: record.student.rollNo,
                        present: 0,
                        absent: 0,
                        holiday: 0,
                        skipped: 0,
                        total: 0
                    };
                }
                aggregated[studentName].total++;
                if (record.status === 'P') aggregated[studentName].present++;
                else if (record.status === 'A') aggregated[studentName].absent++;
                else if (record.status === 'H') aggregated[studentName].holiday++;
                else if (record.status === 'S') aggregated[studentName].skipped++;
            });

            return res.json({
                ok: true,
                type: 'aggregated',
                data: Object.values(aggregated).sort((a, b) => a.studentName.localeCompare(b.studentName))
            });
        }
    } catch (error) {
        console.error("Fetch attendance history error:", error);
        res.status(500).json({ error: "Failed to fetch attendance history" });
    }
});

router.post('/save', async (req, res) => {
    try {
        const { classId, date, attendanceData } = req.body;
        const userId = Number(req.user.userId);

        if (!classId || !date || !attendanceData || !Array.isArray(attendanceData)) {
            return res.status(400).json({ error: "Missing required fields or invalid data format" });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId },
            select: { id: true, schoolId: true }
        });

        if (!teacher) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }

        const isAuthorized = await isAuthorizedForClass(teacher.id, classId);
        if (!isAuthorized) {
            return res.status(403).json({ error: "Access denied: Unauthorized to save attendance for this class" });
        }

        // Use a transaction to save attendance records
        const attendanceDate = new Date(new Date(date).toISOString().split('T')[0]);

        const upsertPromises = attendanceData.map(record => {
            return prisma.attendance.upsert({
                where: {
                    studentId_date: {
                        studentId: parseInt(record.studentId),
                        date: attendanceDate
                    }
                },
                update: {
                    status: record.status,
                    teacherId: teacher.id,
                    updatedAt: new Date()
                },
                create: {
                    studentId: parseInt(record.studentId),
                    classId: parseInt(classId),
                    teacherId: teacher.id,
                    date: attendanceDate,
                    status: record.status,
                    updatedAt: new Date()
                }
            });
        });

        await prisma.$transaction(upsertPromises);

        res.json({ ok: true, message: "Attendance saved successfully" });
    } catch (error) {
        console.error("Save attendance error:", error);
        res.status(500).json({ 
            error: "Failed to save attendance", 
            details: error.message,
            prismaCode: error.code
        });
    }
});

module.exports = router;

