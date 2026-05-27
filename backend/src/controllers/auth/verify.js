const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * =========================
 * EMAIL VERIFICATION ROUTE
 * =========================
 */
router.post("/email", async (req, res) => {
    console.log("[VERIFY] Route hit at", new Date().toISOString());

    const { email, code } = req.body;

    console.log("EMAIL:", email);
    console.log("CODE:", code);

    // ======================
    // BASIC VALIDATION
    // ======================
    if (!email || !code) {
        return res.status(400).json({
            error: "Email and verification code are required"
        });
    }

    try {
        // ======================
        // FIND PENDING REGISTRATION
        // ======================
        const pending = await prisma.pendingregistration.findFirst({
            where: { email }
        });

        console.log("PENDING:", pending);

        // FIX 4 — safe guard FIRST
        if (!pending) {
            return res.status(400).json({
                error: "OTP not found or expired. Please sign up again."
            });
        }

        // ======================
        // FIX 2 — NORMALIZE OTP
        // ======================
        if (String(pending.code).trim() !== String(code).trim()) {
            return res.status(400).json({
                error: "Invalid verification code"
            });
        }

        // ======================
        // EXPIRY CHECK
        // ======================
        if (new Date() > new Date(pending.expiresAt)) {
            return res.status(400).json({
                error: "Verification code expired. Please sign up again."
            });
        }

        const data = pending.data;

        console.log(`[VERIFY] Checking user: ${data.username}, ${data.email}, TYPE: ${data.type}`);

        // ======================
        // EXISTING USER CHECK
        // ======================
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { username: data.username }
                ]
            }
        });

        console.log("[VERIFY] Existing user:", existingUser ? existingUser.id : "null");

        if (existingUser) {
            if (existingUser.emailVerified) {
                await prisma.pendingregistration.delete({
                    where: { id: pending.id }
                });

                return res.json({
                    ok: true,
                    message: "Email already verified. You can login."
                });
            }

            return res.status(400).json({
                error: "User already exists. Please login."
            });
        }

        // ======================
        // ADMIN REGISTRATION
        // ======================
        if (data.type === "ADMIN") {
            const newUser = await prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: "ADMIN",
                    emailVerified: true
                }
            });

            const school = await prisma.school.upsert({
                where: { code: data.schoolCode },
                update: {
                    adminId: newUser.id,
                    name: data.schoolName,
                    email: data.email
                },
                create: {
                    code: data.schoolCode,
                    name: data.schoolName,
                    email: data.email,
                    adminId: newUser.id
                }
            });

            await prisma.user.update({
                where: { id: newUser.id },
                data: { schoolId: school.id }
            });

            data.schoolId = school.id;
        }

        // ======================
        // TEACHER REGISTRATION
        // ======================
        else if (data.type === "TEACHER") {
            const school = await prisma.school.findUnique({
                where: { code: data.schoolCode }
            });

            if (!school) {
                throw new Error("Invalid school code");
            }

            const newUser = await prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: "TEACHER",
                    emailVerified: true,
                    schoolId: school.id
                }
            });

            await prisma.teacher.upsert({
                where: { email: data.email },
                update: {
                    userId: newUser.id,
                    status: "PENDING"
                },
                create: {
                    email: data.email,
                    userId: newUser.id,
                    status: "PENDING",
                    schoolId: school.id
                }
            });
        }

        // ======================
        // STUDENT REGISTRATION
        // ======================
        else if (data.type === "STUDENT") {
            const school = await prisma.school.findUnique({
                where: { code: data.schoolCode }
            });

            if (!school) throw new Error("Invalid school code");

            const classMatch = data.className.match(/^(\d+)\s*([A-Za-z])$/);

            const cls = await prisma.renamedclass.upsert({
                where: {
                    name_section_schoolId: {
                        name: classMatch[1],
                        section: classMatch[2].toUpperCase(),
                        schoolId: school.id
                    }
                },
                update: {},
                create: {
                    name: classMatch[1],
                    section: classMatch[2].toUpperCase(),
                    schoolId: school.id
                }
            });

            const newUser = await prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: "STUDENT",
                    emailVerified: true,
                    schoolId: school.id
                }
            });

            await prisma.student.upsert({
                where: { email: data.email },
                update: {
                    userId: newUser.id,
                    classId: cls.id
                },
                create: {
                    email: data.email,
                    userId: newUser.id,
                    classId: cls.id,
                    schoolId: school.id,
                    firstName: data.firstName,
                    lastName: data.lastName
                }
            });
        }

        // ======================
        // PARENT REGISTRATION
        // ======================
        else if (data.type === "PARENT") {
            const students = await prisma.student.findMany({
                where: {
                    studentCode: { in: data.studentCodes || [] }
                }
            });

            const newUser = await prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: "PARENT",
                    emailVerified: true,
                    schoolId: data.schoolId
                }
            });

            await prisma.parent.upsert({
                where: { email: data.email },
                update: {
                    userId: newUser.id,
                    student: {
                        connect: students.map(s => ({ id: s.id }))
                    }
                },
                create: {
                    email: data.email,
                    userId: newUser.id,
                    schoolId: data.schoolId,
                    student: {
                        connect: students.map(s => ({ id: s.id }))
                    }
                }
            });
        }

        // ======================
        // CLEANUP
        // ======================
        await prisma.pendingregistration.delete({
            where: { id: pending.id }
        });

        // ======================
        // SEND WELCOME EMAIL
        // ======================
        const { sendWelcomeEmail } = require("../../services/mailer");
        await sendWelcomeEmail(data.email, data.firstName || "User", data.schoolId || null);

        return res.json({
            ok: true,
            message: "Email verified successfully. You can now login."
        });

    } catch (error) {
        console.error("[VERIFY ERROR]", error);
        return res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
});

/**
 * =========================
 * RESEND OTP ROUTE
 * =========================
 */
router.post("/resend-code", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            error: "Email is required"
        });
    }

    try {
        const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
        const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const pending = await prisma.pendingregistration.findUnique({
            where: { email }
        });

        if (pending) {
            await prisma.pendingregistration.update({
                where: { id: pending.id },
                data: {
                    code: verificationCode,
                    expiresAt: verificationCodeExpiresAt
                }
            });

            const { sendVerificationEmail } = require("../../services/mailer");
            await sendVerificationEmail(email, verificationCode, pending.data.firstName || "User");

            return res.json({
                ok: true,
                message: "New verification code sent"
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (user) {
            if (user.emailVerified) {
                return res.status(400).json({
                    error: "Email already verified"
                });
            }

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    verificationCode,
                    verificationCodeExpiresAt
                }
            });

            const { sendVerificationEmail } = require("../../services/mailer");
            await sendVerificationEmail(email, verificationCode, user.firstName || "User");

            return res.json({
                ok: true,
                message: "New verification code sent"
            });
        }

        return res.status(404).json({
            error: "No account found"
        });

    } catch (error) {
        console.error("[RESEND ERROR]", error);
        return res.status(500).json({
            error: "Failed to resend code"
        });
    }
});

module.exports = router;