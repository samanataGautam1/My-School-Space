const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

let client;

function getClient() {
    if (!client) {
        const { OAuth2Client } = require('google-auth-library');
        client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
    return client;
}

/**
 * =========================
 * GOOGLE LOGIN (FIXED)
 * =========================
 */
router.post('/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({
            ok: false,
            error: "No token provided"
        });
    }

    try {
        // Verify Google token
        const ticket = await getClient().verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;

        // Get user with correct relations
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                teacher: true,
                student: true,
                parent: {
                    include: {
                        student: true   // ✅ FIXED (correct relation)
                    }
                }
            }
        });

        // User not found
        if (!user) {
            return res.status(403).json({
                ok: false,
                error: "Account not registered. Please sign up first."
            });
        }

        // Auto verify email
        if (!user.emailVerified) {
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true }
            });
        }

        /**
         * =========================
         * FIXED SCHOOL RESOLUTION
         * =========================
         */
        let resolvedSchoolId = null;

        if (user.schoolId) {
            resolvedSchoolId = user.schoolId;
        } else if (user.teacher?.schoolId) {
            resolvedSchoolId = user.teacher.schoolId;
        } else if (user.student?.schoolId) {
            resolvedSchoolId = user.student.schoolId;
        } else if (user.parent?.schoolId) {
            resolvedSchoolId = user.parent.schoolId;
        }

        if (!resolvedSchoolId) {
            return res.status(403).json({
                ok: false,
                error: "No school assigned to this account"
            });
        }

        /**
         * =========================
         * ROLE VALIDATION
         * =========================
         */
        if (user.role === "TEACHER") {
            if (user.teacher?.status !== "ACTIVE") {
                return res.status(403).json({
                    ok: false,
                    error: "Teacher not approved yet"
                });
            }
        }

        if (user.role === "STUDENT") {
            if (!user.student?.isApproved) {
                return res.status(403).json({
                    ok: false,
                    error: "Student not approved yet"
                });
            }
        }

        /**
         * =========================
         * FIXED JWT (SINGLE SOURCE OF TRUTH)
         * =========================
         */
        const jwtToken = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                schoolId: resolvedSchoolId,
                studentId: user.student?.id || null,
                teacherId: user.teacher?.id || null,
                parentId: user.parent?.id || null
            },
            process.env.JWT_SECRET || 'devsecret',
            { expiresIn: '7d' }
        );

        /**
         * =========================
         * FIXED RESPONSE
         * =========================
         */
        return res.json({
            ok: true,
            token: jwtToken,

            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                schoolId: resolvedSchoolId,

                student: user.student || null,
                teacher: user.teacher || null,

                parent: user.parent
                    ? {
                        id: user.parent.id,
                        firstName: user.parent.firstName,
                        lastName: user.parent.lastName,
                        email: user.parent.email,
                        schoolId: user.parent.schoolId,

                        // ✅ FIXED: correct parent → students mapping
                        students: user.parent.student || []
                    }
                    : null
            }
        });

    } catch (error) {
        console.error("Google Auth Error:", error);

        return res.status(500).json({
            ok: false,
            error: "Google authentication failed"
        });
    }
});

module.exports = router;