require("dotenv").config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/* ================= CORE SEND FUNCTION ================= */

async function sendEmail({ to, subject, html }) {
    try {
        const from = process.env.RESEND_FROM_EMAIL || "School Space <onboarding@resend.dev>";

        const { data, error } = await resend.emails.send({
            from,
            to,
            subject,
            html,
        });

        if (error) {
            console.error("❌ Resend error:", error);
            throw error;
        }

        console.log("📧 Email sent:", data.id);
        return data;

    } catch (error) {
        console.error("❌ Email failed:", error);
        throw error;
    }
}

/* ================= EMAIL TYPES ================= */

async function sendVerificationEmail(to, code, name) {
    return sendEmail({
        to,
        subject: "Verify Your Email - School Space",
        html: `
            <h2>Hello ${name}</h2>
            <p>Your OTP is:</p>
            <h1 style="color:green; letter-spacing:5px">${code}</h1>
            <p>Expires in 5 minutes.</p>
        `,
    });
}

async function sendResetEmail(to, code, name) {
    return sendEmail({
        to,
        subject: "Password Reset Code",
        html: `
            <h2>Hello ${name}</h2>
            <p>Your reset code:</p>
            <h1 style="color:red; letter-spacing:5px">${code}</h1>
        `,
    });
}

async function sendWelcomeEmail(to, name, schoolId) {
    return sendEmail({
        to,
        subject: "Welcome to School Space",
        html: `
            <h2>Welcome ${name} 🎉</h2>
            <p>School ID: ${schoolId || "N/A"}</p>
        `,
    });
}

async function sendAdminNotification(to, userName, userRole, action) {
    return sendEmail({
        to,
        subject: `New ${action} Request`,
        html: `<p>${userRole} <b>${userName}</b> requested ${action}</p>`,
    });
}

async function sendSchoolCodeEmail(to, schoolCode, firstName, schoolName) {
    return sendEmail({
        to,
        subject: "School Code Recovery",
        html: `
            <p>Hello ${firstName}</p>
            <p>School: <b>${schoolName}</b></p>
            <h2>${schoolCode}</h2>
        `,
    });
}

async function sendSWOTReportEmail(to, parentName, studentName, teacherName, swot, schoolId) {
    return sendEmail({
        to,
        subject: `SWOT Report for ${studentName}`,
        html: `
            <h2>Hello ${parentName}</h2>
            <p>A SWOT report has been submitted for <b>${studentName}</b> by <b>${teacherName}</b>.</p>
            <table style="border-collapse:collapse;width:100%">
              <tr><th style="background:#e8f5e9;padding:8px">Strength</th><td style="padding:8px">${swot.strength || '—'}</td></tr>
              <tr><th style="background:#fff3e0;padding:8px">Weakness</th><td style="padding:8px">${swot.weakness || '—'}</td></tr>
              <tr><th style="background:#e3f2fd;padding:8px">Opportunity</th><td style="padding:8px">${swot.opportunity || '—'}</td></tr>
              <tr><th style="background:#fce4ec;padding:8px">Threat</th><td style="padding:8px">${swot.threat || '—'}</td></tr>
              <tr><th style="background:#f3e5f5;padding:8px">Suggestion</th><td style="padding:8px">${swot.suggestion || '—'}</td></tr>
            </table>
        `,
    });
}

/* ================= EXPORTS ================= */

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendResetEmail,
    sendWelcomeEmail,
    sendAdminNotification,
    sendSchoolCodeEmail,
    sendSWOTReportEmail,
};