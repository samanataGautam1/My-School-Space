const express = require('express');
const router = express.Router();
const prisma = require("../../../prisma/prisma");

const jwt = require('jsonwebtoken');

let client;
function getClient() {
    if (!client) {
        const { OAuth2Client } = require('google-auth-library');
        client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
    return client;
}

const { authMiddleware } = require('../../middleware/auth');


// =========================
// GET /me
// =========================
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user.userId || req.user.id);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                teacher: true,
                student: true,

                // ✅ FIXED RELATION NAME (IMPORTANT)
                parent: {
                    include: {
                        student: {
                            include: { Renamedclass: true }
                        }
                    }
                },

                school_user_schoolIdToschool: {
                    select: { id: true, name: true, code: true }
                },
                school_school_adminIdTouser: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ ok: false, error: "User not found" });
        }

        let resolvedSchoolId = user.schoolId || user.school_school_adminIdTouser?.id || user.teacher?.schoolId || user.student?.schoolId || user.parent?.schoolId;

        let formattedStudents = [];
        if (user.parent?.student) {
            formattedStudents = user.parent.student.map(s => ({
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                studentCode: s.studentCode,
                className: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section || ''}` : 'N/A'
            }));
        }

        return res.json({
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                schoolId: resolvedSchoolId,
                teacher: user.teacher,
                student: user.student,
                students: formattedStudents,
                parent: {
                    ...user.parent,
                    students: user.parent?.student || []   // ✅ IMPORTANT FIX
                }
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: err.message });
    }
});


// =========================
// GOOGLE LOGIN
// =========================
router.post('/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ ok: false, error: "No token provided" });
    }

    try {
        const ticket = await getClient().verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email } = payload;

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                teacher: true,
                student: true,
                school_school_adminIdTouser: true,
                parent: {
                    include: {
                        student: {
                            include: { Renamedclass: true }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(403).json({
                ok: false,
                error: "Account not registered"
            });
        }

        // verify email
        if (!user.emailVerified) {
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true }
            });
        }

        let resolvedSchoolId = user.schoolId || user.school_school_adminIdTouser?.id || user.teacher?.schoolId || user.student?.schoolId || user.parent?.schoolId;

        if (!resolvedSchoolId) {
            return res.status(403).json({
                ok: false,
                error: "No school assigned"
            });
        }

        // role checks
        if (user.role === "STUDENT") {
            return res.status(403).json({ ok: false, error: "Students cannot login with Google" });
        }

        if (user.role === "TEACHER" && user.teacher?.status !== "ACTIVE") {
            return res.status(403).json({ ok: false, error: "Teacher not active" });
        }

        const tokenJwt = jwt.sign(
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

        let formattedStudents = [];
        if (user.parent?.student) {
            formattedStudents = user.parent.student.map(s => ({
                id: s.id,
                name: `${s.firstName} ${s.lastName}`,
                studentCode: s.studentCode,
                className: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section || ''}` : 'N/A'
            }));
        }

        return res.json({
            ok: true,
            token: tokenJwt,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                schoolId: resolvedSchoolId,
                student: user.student || null,
                students: formattedStudents,
                teacher: user.teacher || null,
                parent: {
                    ...user.parent,
                    students: user.parent?.student || []   // ✅ CRITICAL FIX
                }
            }
        });

    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(401).json({
            ok: false,
            error: "Invalid Google Token"
        });
    }
});

module.exports = router;