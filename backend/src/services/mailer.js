require('dotenv').config();
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cache for transporters (schoolId -> transporter)
const schoolTransporters = new Map();
let defaultTransporter = null;

const PLACEHOLDER_EMAIL = 'your-email@gmail.com';
const PLACEHOLDER_PASS = 'your-app-password';

const isEmailConfigured = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    return user && pass && user !== PLACEHOLDER_EMAIL && pass !== PLACEHOLDER_PASS;
};

const createTransporter = async (schoolId = null, customAuth = null) => {
    // 0. If custom authentication is provided (Used for Admin Signup self-verification)
    if (customAuth && customAuth.user && customAuth.pass) {
        console.log(`✅ Using custom/temporary SMTP credentials for: ${customAuth.user}`);
        const trans = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: customAuth.user,
                pass: customAuth.pass
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        });
        await trans.verify().catch(e => console.error(`❌ Custom SMTP Verify Fail: ${e.message}`));
        return trans;
    }

    // 1. Check for school-specific transporter in cache
    if (schoolId && schoolTransporters.has(schoolId)) {
        return schoolTransporters.get(schoolId);
    }

    // 2. Try to create school-specific transporter from DB
    if (schoolId) {
        try {
            const school = await prisma.school.findUnique({
                where: { id: parseInt(schoolId) },
                select: { email: true, emailPass: true }
            });

            if (school && school.email && school.emailPass) {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: school.email,
                        pass: school.emailPass
                    },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 10000
                });
                await transporter.verify().catch(e => console.error(`❌ School SMTP Verify Fail (ID ${schoolId}): ${e.message}`));
                schoolTransporters.set(schoolId, transporter);
                console.log(`✅ Using School-specific SMTP for school ID: ${schoolId}`);
                return transporter;
            }
        } catch (err) {
            console.error(`❌ Error fetching school email credentials for ID ${schoolId}:`, err);
        }
    }

    // 3. Fallback to default transporter (from .env)
    if (defaultTransporter) {
        console.log(`♻️ Using cached default transporter for: ${process.env.EMAIL_USER}`);
        return defaultTransporter;
    }

    if (isEmailConfigured()) {
        defaultTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        });
        await defaultTransporter.verify().catch(e => console.error(`❌ Default SMTP Verify Fail: ${e.message}`));
        console.log(`✅ Initialized Default Gmail SMTP (from .env): ${process.env.EMAIL_USER}`);
    } else {
        console.log("⚠️ No real SMTP credentials found in .env. Falling back to Ethereal.");
        const testAccount = await nodemailer.createTestAccount();
        defaultTransporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log("✅ Using Ethereal test email for default transporter.");
    }
    const authUser = defaultTransporter?.options?.auth?.user || 'none';
    const authPass = defaultTransporter?.options?.auth?.pass ? '******' : 'none';
    console.log(`📡 Default Transporter ready. User: ${authUser}, Pass: ${authPass}`);

    return defaultTransporter;
};

// Wrapper function to send mail using the dynamic transporter
const sendMailWrapper = async (mailOptions, schoolId = null, customAuth = null) => {
    const fs = require('fs');
    const logFile = 'mailer_debug.log';
    const timestamp = new Date().toISOString();

    try {
        const transport = await createTransporter(schoolId, customAuth);

        // Ensure 'from' matches the transporter user
        const fromAddr = transport.options.auth?.user || process.env.EMAIL_USER;
        if (!mailOptions.from || mailOptions.from === PLACEHOLDER_EMAIL) {
            mailOptions.from = fromAddr;
        }

        const logAttempt = `[${timestamp}] ATTEMPT: To=[${mailOptions.to}] Sub=[${mailOptions.subject}] School=[${schoolId}]\n`;
        fs.appendFileSync(logFile, logAttempt);
        console.log(`📨 ${logAttempt.trim()}`);

        const info = await transport.sendMail(mailOptions);

        const logSuccess = `[${timestamp}] SUCCESS: To=[${mailOptions.to}] MsgID=[${info.messageId}]\n`;
        fs.appendFileSync(logFile, logSuccess);
        console.log(`✅ ${logSuccess.trim()}`);
        return info;
    } catch (error) {
        const logError = `[${timestamp}] ERROR: To=[${mailOptions.to}] Msg=[${error.message}] Code=[${error.code}]\n`;
        fs.appendFileSync(logFile, logError);
        console.error(`❌ ${logError.trim()}`);

        const smtpLog = `[${timestamp}] SMTP ERROR: ${error.message} | Code: ${error.code} | To: ${mailOptions.to}\n`;
        fs.appendFileSync('smtp_log.txt', smtpLog);

        throw error;
    }
};

/**
 * Send OTP Verification Email
 */
async function sendVerificationEmail(to, code, name, schoolId = null, customAuth = null) {
    console.log(`🚀 sendVerificationEmail called: to=${to}, schoolId=${schoolId}, hasCustomAuth=${!!customAuth}`);
    const mailOptions = {
        to: to,
        subject: 'Verify Your Email - School Space',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
                <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #0f172a; margin: 0; font-size: 24px;">MySchool<span style="color: #059669;">Space</span></h1>
                        <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Welcome to your educational hub</p>
                    </div>
                    <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.5;">Hello ${name},</p>
                    <p style="color: #666; font-size: 16px; line-height: 1.5;">
                        Thank you for registering! Please use the following code to verify your email address:
                    </p>
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 2px dashed #e2e8f0;">
                        <h1 style="color: #059669; letter-spacing: 8px; margin: 0; font-size: 32px;">${code}</h1>
                    </div>
                    <p style="color: #999; font-size: 14px; line-height: 1.5;">
                        This code will expire in 5 minutes.
                    </p>
                </div>
            </div>
        `
    };
    return sendMailWrapper(mailOptions, schoolId, customAuth);
}

/**
 * Send Password Reset Code
 */
async function sendResetEmail(to, code, name, schoolId = null) {
    const mailOptions = {
        to: to,
        subject: 'Password Recovery Code - School Space',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
                <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.5;">Hello ${name},</p>
                    <p style="color: #666; font-size: 16px; line-height: 1.5;">Use the code below to complete your password reset:</p>
                    <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 2px dashed #fed7aa;">
                        <h1 style="color: #ea580c; letter-spacing: 8px; margin: 0; font-size: 32px;">${code}</h1>
                    </div>
                </div>
            </div>
        `
    };
    return sendMailWrapper(mailOptions, schoolId);
}

/**
 * Send JWT Token Email after login
 */
async function sendJWTEmail(to, token, name, schoolId = null) {
    // Disabled as per user request to stop login emails
    console.log(`[MAILER] sendJWTEmail suppressed for ${to}`);
    return;
}

// Additional functions simplified for brevity but all supporting schoolId
async function sendAdminNotification(to, userName, userRole, action, schoolId = null) {
    const mailOptions = {
        to: to,
        subject: `New Request: ${action.toUpperCase()}`,
        html: `<p>A <strong>${userRole}</strong> named <strong>${userName}</strong> has requested a <strong>${action}</strong>.</p>`
    };
    return sendMailWrapper(mailOptions, schoolId);
}

async function sendSchoolCodeEmail(to, schoolCode, firstName, schoolName, schoolId = null) {
    const mailOptions = {
        to,
        subject: 'School Code Recovery',
        html: `<p>Hello ${firstName}, your code for ${schoolName} is <strong>${schoolCode}</strong></p>`
    };
    return sendMailWrapper(mailOptions, schoolId);
}

async function sendWelcomeEmail(to, name, schoolId = null) {
    const mailOptions = {
        to,
        subject: 'Welcome to School Space!',
        html: `<p>Welcome, ${name}! Your account is now active.</p>`
    };
    return sendMailWrapper(mailOptions, schoolId);
}

async function sendSWOTReportEmail(to, parentName, studentName, teacherName, feedback, schoolId = null) {
    // Disabled as per user request
    console.log(`[MAILER] sendSWOTReportEmail suppressed for ${to}`);
    return;
}

async function sendPerformanceReportEmail(to, parentName, studentName, metrics, schoolId = null) {
    // Disabled as per user request
    console.log(`[MAILER] sendPerformanceReportEmail suppressed for ${to}`);
    return;
}

async function sendFinalSessionReportEmail(to, parentName, studentName, sessionData, schoolId = null) {
    // Disabled as per user request
    console.log(`[MAILER] sendFinalSessionReportEmail suppressed for ${to}`);
    return;
}

async function sendTeacherComplaintEmail(to, parentName, teacherName, studentName, subject, messageBody, schoolId = null) {
    const date = new Date().toLocaleDateString();
    const mailOptions = {
        to,
        subject: `Disciplinary/Academic Notice for ${studentName}: ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #fee2e2; border-radius: 8px; padding: 25px;">
                <h2 style="color: #991b1b;">Student Notice</h2>
                <p>Hello ${parentName},</p>
                <p>This is a formal notice regarding <strong>${studentName}</strong>.</p>
                
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p><strong>Subject:</strong> ${subject}</p>
                    <p><strong>Message:</strong></p>
                    <p>${messageBody}</p>
                </div>
                
                <p style="font-size: 14px;">
                    <strong>Teacher:</strong> ${teacherName}<br>
                    <strong>Date:</strong> ${date}
                </p>
                
                <p style="margin-top: 20px; font-size: 12px; color: #666;">Please login to the portal for more details or to respond.</p>
            </div>
        `
    };
    return sendMailWrapper(mailOptions, schoolId);
}

module.exports = {
    sendResetEmail,
    sendSchoolCodeEmail,
    sendAdminNotification,
    sendWelcomeEmail,
    sendVerificationEmail,
    sendTeacherComplaintEmail,
    sendSWOTReportEmail,
    sendPerformanceReportEmail,
    sendFinalSessionReportEmail,
    sendJWTEmail,
    sendEmail: async (to, subject, html, schoolId = null) => {
        return sendMailWrapper({ to, subject, html }, schoolId);
    }
};
