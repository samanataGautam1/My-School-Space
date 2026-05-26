require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/* ================= CORE EMAIL SENDER ================= */

async function sendEmail({ to, subject, html }) {
    try {
        const result = await resend.emails.send({
            from: "School Space <onboarding@resend.dev>", // change later to your domain
            to,
            subject,
            html,
        });

        console.log("📧 Email sent:", result);
        return result;
    } catch (error) {
        console.error("❌ Email send failed:", error);
        throw error;
    }
}

/* ================= EMAIL FUNCTIONS ================= */

/**
 * Verification Email
 */
async function sendVerificationEmail(to, code, name) {
    return sendEmail({
        to,
        subject: "Verify Your Email - School Space",
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Hello ${name}</h2>
                <p>Your verification code is:</p>
                <h1 style="letter-spacing:5px; color:green">${code}</h1>
                <p>This code expires in 5 minutes.</p>
            </div>
        `
    });
}

/**
 * Welcome Email
 */
async function sendWelcomeEmail(to, name) {
    return sendEmail({
        to,
        subject: "Welcome to School Space!",
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Welcome ${name} 🎉</h2>
                <p>Your account has been successfully created.</p>
            </div>
        `
    });
}

/**
 * Reset Password Email
 */
async function sendResetEmail(to, code, name) {
    return sendEmail({
        to,
        subject: "Password Reset Code",
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Hello ${name}</h2>
                <p>Your password reset code is:</p>
                <h1 style="letter-spacing:5px; color:red">${code}</h1>
            </div>
        `
    });
}

/**
 * Admin Notification Email
 */
async function sendAdminNotification(to, userName, userRole, action) {
    return sendEmail({
        to,
        subject: `New ${action} Request`,
        html: `
            <p>${userRole} <b>${userName}</b> requested <b>${action}</b>.</p>
        `
    });
}

/**
 * School Code Email
 */
async function sendSchoolCodeEmail(to, schoolCode, firstName, schoolName) {
    return sendEmail({
        to,
        subject: "School Code Recovery",
        html: `
            <p>Hello ${firstName},</p>
            <p>Your school code for <b>${schoolName}</b> is:</p>
            <h2>${schoolCode}</h2>
        `
    });
}

/* ================= DISABLED EMAILS (KEEP FOR SAFETY) ================= */

async function sendJWTEmail() {
    console.log("[MAILER] sendJWTEmail disabled");
}

async function sendSWOTReportEmail() {
    console.log("[MAILER] sendSWOTReportEmail disabled");
}

async function sendPerformanceReportEmail() {
    console.log("[MAILER] sendPerformanceReportEmail disabled");
}

async function sendFinalSessionReportEmail() {
    console.log("[MAILER] sendFinalSessionReportEmail disabled");
}

async function sendTeacherComplaintEmail(to) {
    console.log("[MAILER] sendTeacherComplaintEmail (simplified) sent to:", to);
    return sendEmail({
        to,
        subject: "Student Notice",
        html: `<p>Please check your portal for updates.</p>`
    });
}

/* ================= EXPORTS ================= */

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendResetEmail,
    sendAdminNotification,
    sendSchoolCodeEmail,
    sendTeacherComplaintEmail,

    sendJWTEmail,
    sendSWOTReportEmail,
    sendPerformanceReportEmail,
    sendFinalSessionReportEmail,

    sendEmail
};