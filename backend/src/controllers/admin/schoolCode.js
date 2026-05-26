const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { sendSchoolCodeEmail, sendAdminNotification } = require('../../services/mailer');
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { validateEmail } = require('../../utils/validators');

const prisma = new PrismaClient();
const router = express.Router();

/* ================= REQUEST SCHOOL CODE RECOVERY ================= */
router.post('/request', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json({ error: emailValidation.error });
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: emailValidation.value },
            include: { school: { select: { id: true, name: true, code: true } } }
        });

        if (!user) {
            return res.status(404).json({
                error: 'No account found with this email address'
            });
        }

        // Students cannot request school code recovery (security measure)
        if (user.role === 'STUDENT') {
            return res.status(403).json({
                error: 'Students cannot request school code recovery. Please contact your school administrator directly.'
            });
        }

        // Check if user has verified email
        if (!user.emailVerified && user.role !== 'ADMIN') {
            return res.status(400).json({
                error: 'Your email is not verified. Please contact your school administrator.'
            });
        }

        // Check for existing pending request
        const existingRequest = await prisma.schoolCodeRequest.findFirst({
            where: {
                userId: user.id,
                status: 'PENDING',
                expiresAt: { gte: new Date() }
            }
        });

        if (existingRequest) {
            return res.status(400).json({
                error: 'You already have a pending school code request. Please wait for admin approval.'
            });
        }

        // Create school code request
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.schoolCodeRequest.create({
            data: {
                email: emailValidation.value,
                userId: user.id,
                status: 'PENDING',
                expiresAt: expiresAt
            }
        });

        // Notify admin
        const admin = await prisma.user.findFirst({
            where: { role: 'ADMIN', schoolId: user.schoolId }
        });

        if (admin && admin.email) {
            await sendAdminNotification(
                admin.email,
                `${user.firstName} ${user.lastName}`,
                user.role,
                'school code recovery'
            );
        }

        res.json({
            ok: true,
            message: 'School code recovery request submitted. Your school administrator will review and respond within 24 hours.'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process school code request. Please try again.' });
    }
});

/* ================= ADMIN: GET ALL SCHOOL CODE REQUESTS ================= */
router.get('/admin/requests', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;

        const requests = await prisma.schoolCodeRequest.findMany({
            where: {
                user: { schoolId: schoolId },
                status: 'PENDING',
                expiresAt: { gte: new Date() }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch school code requests' });
    }
});

/* ================= ADMIN: APPROVE SCHOOL CODE REQUEST ================= */
router.post('/admin/approve/:id', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const request = await prisma.schoolCodeRequest.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    include: { school: { select: { id: true, name: true, code: true } } }
                }
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.expiresAt < new Date()) {
            return res.status(400).json({ error: 'This request has expired' });
        }

        if (!request.user || !request.user.school) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Update request status
        await prisma.schoolCodeRequest.update({
            where: { id: parseInt(id) },
            data: { status: 'ACCEPTED' }
        });

        // Send school code to user's email
        await sendSchoolCodeEmail(
            request.email,
            request.user.school.code,
            request.user.firstName,
            request.user.school.name
        );

        res.json({
            ok: true,
            message: `School code sent to ${request.user.firstName} ${request.user.lastName} at ${request.email}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to approve school code request' });
    }
});

/* ================= ADMIN: REJECT SCHOOL CODE REQUEST ================= */
router.post('/admin/reject/:id', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const request = await prisma.schoolCodeRequest.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Update request status
        await prisma.schoolCodeRequest.update({
            where: { id: parseInt(id) },
            data: { status: 'REJECTED' }
        });

        // Optionally send rejection email (you can implement this in mailer.js)
        // await sendRejectionEmail(request.email, request.user.firstName, reason);

        res.json({
            ok: true,
            message: `School code request rejected for ${request.user.firstName} ${request.user.lastName}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reject school code request' });
    }
});

module.exports = router;

