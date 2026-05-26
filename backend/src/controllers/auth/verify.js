const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.post("/email", async (req, res) => {
    require('fs').appendFileSync('verify_hit.log', 'Hit at ' + new Date().toISOString() + '\n');
    console.log("VERIFY_ROUTE_HIT");
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
    }

    try {
        // 1. Check for Pending Registration (New Flow)
        const pending = await prisma.pendingregistration.findUnique({
            where: { email }
        });

        if (pending) {
            if (pending.code !== code) {
                return res.status(400).json({ error: "Invalid validation code" });
            }

            if (new Date() > pending.expiresAt) {
                return res.status(400).json({ error: "Validation code has expired. Please signup again." });
            }

            const data = pending.data;

            // detailed logging
            const fs = require('fs');
            fs.appendFileSync('verify_debug.log', `Checking user: ${data.username}, ${data.email}, TYPE: ${data.type || 'UNDEFINED'}, ROLE: ${data.role || 'UNDEFINED'}\n`);
            fs.appendFileSync('verify_debug.log', `FULL DATA: ${JSON.stringify(data)}\n`);

            // Check if user already exists (idempotency/cleanup)
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: data.email },
                        { username: data.username }
                    ]
                }
            });

            fs.appendFileSync('verify_debug.log', `Existing user found: ${existingUser ? existingUser.id : 'null'}\n`);

            if (existingUser) {
                // If user exists and is verified, just cleanup pending
                if (existingUser.emailVerified) {
                    await prisma.pendingregistration.delete({ where: { id: pending.id } });
                    return res.json({
                        ok: true,
                        message: "Email verified successfully. You can now login."
                    });
                }

                // If user exists but NOT verified, we might have a zombie record.
                // For safety, let's delete the zombie and re-create to ensure data consistency
                // OR we could just return an error. Deleting is risky if it has other data.
                // Given this is signup flow, it's likely safe, but let's error to be safe.
                return res.status(400).json({ error: "User already exists. Please login." });
            }

            // Logic to create the actual user/school based on type
            // currently only ADMIN supported in this new flow
            if (data.type === 'ADMIN') {
                // Create User + School for Admin
                try {
                    const newUser = await prisma.user.create({
                        data: {
                            username: data.username,
                            password: data.password, // already hashed
                            firstName: data.firstName,
                            lastName: data.lastName,
                            email: data.email,
                            role: "ADMIN",
                            emailVerified: true, // Verified!
                        }
                    });

                    // Create or Update school to link this admin
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

                    // Update newUser's schoolId to the created/updated school.id
                    await prisma.user.update({
                        where: { id: newUser.id },
                        data: { schoolId: school.id }
                    });

                    data.schoolId = school.id; // Store for Welcome email
                } catch (createErr) {
                    if (createErr.code === 'P2002') { // Unique constraint violation
                        return res.status(400).json({ error: "Username or email already taken (detected during creation)." });
                    }
                    throw createErr;
                }
            } else if (data.type === 'TEACHER') {
                // Handle Teacher Creation
                const school = await prisma.school.findUnique({
                    where: { code: data.schoolCode },
                    select: { id: true, adminId: true }
                });

                if (!school) {
                    throw new Error("School code invalid during final creation");
                }

                // Prepare Teacher Assignments (Subjects/Classes)
                const teacherSubjectCreates = [];
                const assignments = data.assignments || [];

                for (const assign of assignments) {
                    const { subject: subName, className: clsInput } = assign;

                    if (!clsInput) continue;

                    const classMatch = clsInput.trim().match(/^(\d+)\s*([A-Za-z])$/);

                    if (!classMatch) continue; // Should be validated already

                    const gradeName = classMatch[1];
                    const sectionName = classMatch[2].toUpperCase();

                    // 1. Find or Create Class (Lazy Creation)
                    let cls = await prisma.renamedclass.findFirst({
                        where: { schoolId: school.id, name: gradeName, section: sectionName }
                    });
                    if (!cls) {
                        cls = await prisma.renamedclass.create({
                            data: { name: gradeName, section: sectionName, schoolId: school.id }
                        });
                    }

                    // 2. Find or Create Subject (Lazy Creation)
                    let sub = await prisma.subject.findUnique({
                        where: { name_schoolId: { name: subName, schoolId: school.id } }
                    });
                    if (!sub) {
                        sub = await prisma.subject.create({
                            data: { name: subName, schoolId: school.id }
                        });
                    }

                    // 3. Prepare Link (Using connect syntax for nested create)
                    teacherSubjectCreates.push({
                        subject: { connect: { id: sub.id } },
                        Renamedclass: { connect: { id: cls.id } }
                    });
                }

                // Create User + Teacher Profile
                try {
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

                    // Create or Update Teacher record
                    const teacherResult = await prisma.teacher.upsert({
                        where: { email: data.email },
                        update: {
                            userId: newUser.id,
                            status: "PENDING",
                            schoolId: school.id,
                            isClassTeacher: !!data.classTeacherFor,
                            teachersubject: {
                                create: teacherSubjectCreates
                            }
                        },
                        create: {
                            email: data.email,
                            userId: newUser.id,
                            status: "PENDING",
                            schoolId: school.id,
                            isClassTeacher: !!data.classTeacherFor,
                            teachersubject: {
                                create: teacherSubjectCreates
                            }
                        }
                    });

                    // If they signed up as a class teacher, link them to the class
                    if (data.classTeacherFor) {
                        const classMatch = data.classTeacherFor.trim().match(/^(\d+)\s*([A-Za-z])$/);
                        if (classMatch) {
                            const gName = classMatch[1];
                            const sName = classMatch[2].toUpperCase();
                            
                            let cls = await prisma.renamedclass.findFirst({
                                where: { schoolId: school.id, name: gName, section: sName }
                            });
                            
                            if (!cls) {
                                cls = await prisma.renamedclass.create({
                                    data: {
                                        name: gName,
                                        section: sName,
                                        schoolId: school.id,
                                        classHeadId: teacherResult.id
                                    }
                                });
                            } else {
                                await prisma.renamedclass.update({
                                    where: { id: cls.id },
                                    data: { classHeadId: teacherResult.id }
                                });
                            }
                        }
                    }

                } catch (createErr) {
                    if (createErr.code === 'P2002') {
                        return res.status(400).json({ error: "Username or email already taken (detected during creation)." });
                    }
                    throw createErr;
                }

                // Notify School Admin
                if (school.adminId) {
                    try {
                        const subjectNames = (data.assignments || []).map(a => a.subject).join(', ') || 'N/A';
                        const adminMsg = `New Teacher Registration: ${data.firstName} ${data.lastName} | Subjects: ${subjectNames}${data.classTeacherFor ? ` | Class Head Request: ${data.classTeacherFor}` : ''} | Status: Pending Approval.`;
                        
                        await prisma.notification.create({
                            data: {
                                adminId: school.adminId,
                                message: adminMsg,
                                schoolId: school.id,
                                type: 'TEACHER_SIGNUP'
                            }
                        });
                    } catch (notifyErr) {
                        console.error("Failed to create admin notification:", notifyErr);
                    }
                }
            } else if (data.type === 'STUDENT') {
                const school = await prisma.school.findUnique({
                    where: { code: data.schoolCode },
                    select: { id: true, adminId: true }
                });

                if (!school) throw new Error("School code invalid");

                const classMatch = data.className.trim().match(/^(\d+)\s*([A-Za-z])$/);
                const gradeName = classMatch[1];
                const sectionName = classMatch[2].toUpperCase();

                let cls = await prisma.renamedclass.findFirst({
                    where: { schoolId: school.id, name: gradeName, section: sectionName }
                });
                if (!cls) {
                    cls = await prisma.renamedclass.create({
                        data: { name: gradeName, section: sectionName, schoolId: school.id }
                    });
                }

                try {
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

                    // Create or Update Student record
                    await prisma.student.upsert({
                        where: { email: data.email },
                        update: {
                            userId: newUser.id,
                            studentCode: data.studentCode,
                            rollNo: data.rollNo,
                            classId: cls.id,
                            schoolId: school.id,
                            firstName: data.firstName,
                            lastName: data.lastName
                        },
                        create: {
                            email: data.email,
                            userId: newUser.id,
                            studentCode: data.studentCode,
                            rollNo: data.rollNo,
                            classId: cls.id,
                            schoolId: school.id,
                            firstName: data.firstName,
                            lastName: data.lastName
                        }
                    });

                    if (school.adminId) {
                        await prisma.notification.create({
                            data: {
                                adminId: school.adminId,
                                message: `Student ${data.firstName} ${data.lastName} verified email and joined Class ${gradeName}${sectionName}.`,
                                schoolId: school.id
                            }
                        });
                    }
                } catch (createErr) {
                    if (createErr.code === 'P2002') return res.status(400).json({ error: "Existing account detected." });
                    throw createErr;
                }
            } else if (data.type === 'PARENT') {
                const students = await prisma.student.findMany({
                    where: { studentCode: { in: data.studentCodes } }
                });

                try {
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

                    // Create or Update Parent record
                    await prisma.parent.upsert({
                        where: { email: data.email },
                        update: {
                            userId: newUser.id,
                            schoolId: data.schoolId,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            student: {
                                connect: students.map(s => ({ id: s.id }))
                            }
                        },
                        create: {
                            email: data.email,
                            userId: newUser.id,
                            schoolId: data.schoolId,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            student: {
                                connect: students.map(s => ({ id: s.id }))
                            }
                        }
                    });

                    const school = await prisma.school.findUnique({
                        where: { id: data.schoolId },
                        select: { adminId: true }
                    });

                    if (school && school.adminId) {
                        await prisma.notification.create({
                            data: {
                                adminId: school.adminId,
                                message: `Parent ${data.firstName} ${data.lastName} verified email and joined.`,
                                schoolId: data.schoolId
                            }
                        });
                    }
                } catch (createErr) {
                    if (createErr.code === 'P2002') return res.status(400).json({ error: "Existing account detected." });
                    throw createErr;
                }
            } else {
                return res.status(400).json({ error: "Invalid registration type" });
            }

            // Cleanup pending
            await prisma.pendingregistration.delete({ where: { id: pending.id } });

            // Send Welcome Email
            const { sendWelcomeEmail } = require("../../services/mailer");
            await sendWelcomeEmail(data.email, data.firstName || "User", data.schoolId || null);

            return res.json({
                ok: true,
                message: "Email verified and account created successfully. You can now login."
            });
        }

        // 2. Check for Existing User (Legacy/other Flow)
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(404).json({ error: "No pending registration or user found." });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }

        if (!user.verificationCode || !user.verificationCodeExpiresAt) {
            return res.status(400).json({ error: "No verification code needed or invalid state" });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: "Invalid verification code" });
        }

        if (new Date() > user.verificationCodeExpiresAt) {
            return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
        }

        // Mark as verified and clear code
        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                verificationCode: null,
                verificationCodeExpiresAt: null
            }
        });

        // Send Welcome Email
        const { sendWelcomeEmail } = require("../../services/mailer");
        await sendWelcomeEmail(user.email, user.firstName || "User");

        res.json({
            ok: true,
            message: "Email verified successfully. You can now login."
        });

    } catch (error) {
        console.error("VERIFY_ERROR_STACK:", error.stack);
        console.error("VERIFY_ERROR_MSG:", error.message);
        require('fs').appendFileSync('verify_error.log', `[${new Date().toISOString()}] ERROR: ${error.stack}\n`);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
});

router.post("/resend-code", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
        const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 1. Check PendingRegistration
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
                message: "A new verification code has been sent to your email.",

            });
        }

        // 2. Check User (Unverified)
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (user) {
            if (user.emailVerified) {
                return res.status(400).json({ error: "Email is already verified. Please login." });
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
                message: "A new verification code has been sent to your email.",

            });
        }

        return res.status(404).json({ error: "No pending registration found for this email." });

    } catch (error) {
        console.error("RESEND_CODE_ERROR:", error);
        res.status(500).json({ error: "Failed to resend code. Please try again." });
    }
});

module.exports = router;
