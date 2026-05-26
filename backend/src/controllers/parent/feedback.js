const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, allowRoles } = require('../../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

router.use(authMiddleware, allowRoles('PARENT'));

// 1. Get Parent's Children
router.get('/children', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parent = await prisma.parent.findUnique({
            where: { userId },
            include: { student: { include: { user: true } } }
        });

        if (!parent) {
            return res.status(404).json({ error: 'Parent profile not found' });
        }

        res.json({ ok: true, data: parent.student });
    } catch (err) {
        console.error("Get Children Error:", err);
        res.status(500).json({ error: 'Failed to fetch children' });
    }
});

// 2. Validate Student System
router.get('/validate-student', async (req, res) => {
    try {
        const { studentId } = req.query; // This is the INPUT string (likely studentCode)

        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        // Search by studentCode first, then by internal ID if numeric
        let student = await prisma.student.findUnique({
            where: { studentCode: studentId }
        });

        if (!student && !isNaN(studentId)) {
            student = await prisma.student.findUnique({
                where: { id: parseInt(studentId) }
            });
        }

        if (student) {
            res.json({ ok: true, exists: true, studentId: student.id });
        } else {
            res.json({ ok: true, exists: false });
        }
    } catch (err) {
        console.error("Validate Student Error:", err);
        res.status(500).json({ error: 'Validation failed' });
    }
});

// 3. Submit Feedback Request
router.post('/request', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const { studentId, preference } = req.body;

        if (!studentId || isNaN(parseInt(studentId))) {
            return res.status(400).json({ error: 'Valid numeric Student ID is required' });
        }

        const numericStudentId = parseInt(studentId);

        const parent = await prisma.parent.findUnique({ where: { userId } });
        if (!parent) return res.status(404).json({ error: 'Parent profile not found' });

        // Check if student belongs to parent (security)
        const isChild = await prisma.parent.findFirst({
            where: {
                id: parent.id,
                student: { some: { id: numericStudentId } }
            }
        });

        if (!isChild) {
            return res.status(403).json({ error: 'Access denied. This student is not linked to your account.' });
        }

        const newRequest = await prisma.feedbackrequest.create({
            data: {
                parentId: parent.id,
                studentId: numericStudentId,
                preference: preference || 'SYSTEM',
                status: 'PENDING'
            }
        });

        res.json({ ok: true, message: 'Request submitted', data: newRequest });
    } catch (err) {
        console.error("Feedback Request Error:", err);
        res.status(500).json({ error: 'Failed to submit request' });
    }
});

// 4. Get Feedback Requests History
router.get('/requests', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parent = await prisma.parent.findUnique({ where: { userId } });
        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        const requests = await prisma.feedbackrequest.findMany({
            where: { parentId: parent.id },
            include: { student: { include: { user: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: requests });
    } catch (err) {
        console.error("Get Requests Error:", err);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// 5. Get Feedback Reports (Actual Reports)
router.get('/reports', async (req, res) => {
    try {
        const userId = Number(req.user.userId);
        const parent = await prisma.parent.findUnique({ where: { userId } });
        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        // Get all students of this parent
        const students = await prisma.student.findMany({
            where: { parent: { some: { id: parent.id } } },
            select: { id: true }
        });
        const studentIds = students.map(s => s.id);

        const reports = await prisma.feedback.findMany({
            where: { studentId: { in: studentIds } },
            include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: reports });
    } catch (err) {
        console.error("Get Reports Error:", err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

module.exports = router;

