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
                    email: data.email,
                    emailPass: data.emailPass
                },
                create: {
                    code: data.schoolCode,
                    name: data.schoolName,
                    email: data.email,
                    adminId: newUser.id,
                    emailPass: data.emailPass
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
                where: { id: data.schoolId },
                select: { id: true, adminId: true, code: true }
            });

            if (!school) throw new Error("Invalid school reference");

            // Parse class name
            const classMatch = data.className.match(/^(\d+)\s*([A-Za-z])$/);
            if (!classMatch) throw new Error("Invalid class format in pending data");

            const gradeName = classMatch[1];
            const sectionName = classMatch[2].toUpperCase();

            // Find or Create Class (Lazy Creation)
            const classModel = prisma.renamedclass || prisma.Renamedclass;
            let cls = await classModel.findFirst({
                where: {
                    schoolId: school.id,
                    name: gradeName,
                    section: sectionName
                }
            });

            if (!cls) {
                cls = await classModel.create({
                    data: {
                        name: gradeName,
                        section: sectionName,
                        schoolId: school.id
                    }
                });
            }

            // Create User (Inactive until approved, but email is now verified)
            const newUser = await prisma.user.create({
                data: {
                    username: data.username,
                    password: data.password,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    role: "STUDENT",
                    emailVerified: true,
                    isActive: false, // Students need manual approval
                    schoolId: school.id
                }
            });

            // Helper to generate student code (redundant but safe)
            const generateStudentCode = (schoolCode) => {
                const prefix = (schoolCode || 'SCHL').substring(0, 4).toUpperCase();
                const suffix = require('crypto').randomBytes(2).toString('hex').toUpperCase();
                return `${prefix}${suffix}`;
            };

            const newStudent = await prisma.student.create({
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    rollNo: data.rollNo,
                    studentCode: generateStudentCode(school.code),
                    userId: newUser.id,
                    schoolId: school.id,
                    classId: cls.id,
                    isApproved: false
                }
            });

            // Notify the Class Teacher or Admin
            const notificationMsg = `New student verified: ${data.firstName} ${data.lastName} for Class ${gradeName}${sectionName}. Approval required.`;
            if (cls.classHeadId) {
                await prisma.notification.create({
                    data: {
                        teacherId: cls.classHeadId,
                        message: notificationMsg,
                        schoolId: school.id,
                        type: 'APPROVAL_REQUEST'
                    }
                });
            } else if (school.adminId) {
                await prisma.notification.create({
                    data: {
                        adminId: school.adminId,
                        message: notificationMsg,
                        schoolId: school.id,
                        type: 'APPROVAL_REQUEST'
                    }
                });
            }
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
        // Fetch school email config for welcome email SMTP
        const schoolForWelcome = data.schoolId ? await prisma.school.findUnique({
            where: { id: data.schoolId },
            select: { email: true, emailPass: true }
        }) : null;

        const { sendWelcomeEmail } = require("../../services/mailer");
        await sendWelcomeEmail(
            data.email,
            data.firstName || "User",
            data.schoolId || null,
            { smtpUser: schoolForWelcome?.email, smtpPass: schoolForWelcome?.emailPass }
        );

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

            // Get school info for SMTP
            let smtpConfig = {};
            if (pending.data.type === 'ADMIN') {
                smtpConfig = { smtpUser: pending.email, smtpPass: pending.data.emailPass };
            } else {
                // Fetch school by code
                const school = await prisma.school.findUnique({
                    where: { code: pending.data.schoolCode },
                    select: { email: true, emailPass: true }
                });
                if (school) smtpConfig = { smtpUser: school.email, smtpPass: school.emailPass };
            }

            const { sendVerificationEmail } = require("../../services/mailer");
            await sendVerificationEmail(email, verificationCode, pending.data.firstName || "User", smtpConfig);

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

            // Get school info for already registered but unverified user
            let smtpConfig = {};
            if (user.schoolId) {
                const school = await prisma.school.findUnique({
                    where: { id: user.schoolId },
                    select: { email: true, emailPass: true }
                });
                if (school) smtpConfig = { smtpUser: school.email, smtpPass: school.emailPass };
            }

            const { sendVerificationEmail } = require("../../services/mailer");
            await sendVerificationEmail(email, verificationCode, user.firstName || "User", smtpConfig);

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