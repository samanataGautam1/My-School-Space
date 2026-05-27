require("dotenv").config();
const nodemailer = require("nodemailer");
const dns = require("dns");
const sgMail = require("@sendgrid/mail");

// 🌐 Force Node.js to prefer IPv4 over IPv6 (helps on non-Vercel deployments).
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
}

// Initialize SendGrid if key is provided
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/* ================= CORE SEND FUNCTION ================= */

/**
 * Sends an email using:
 *   1. SendGrid API (primary - works on Vercel/serverless, requires SENDGRID_API_KEY + SENDGRID_FROM_EMAIL)
 *   2. Nodemailer SMTP (fallback - works on non-serverless. Set EMAIL_USER + EMAIL_PASS in .env)
 *
 * School-specific SMTP credentials (smtpUser/smtpPass) skip SendGrid and go straight to SMTP.
 */
async function sendEmail({ to, subject, html, smtpUser, smtpPass }) {
    console.log(`📧 Attempting to send email to ${to}...`);

    const hasSchoolSMTP = smtpUser && smtpPass;

    // ── 1. SendGrid (preferred for production/Vercel) ──────────────────────────
    // Only use SendGrid when no school-specific SMTP is provided.
    if (!hasSchoolSMTP && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        try {
            console.log("📤 Trying SendGrid...");
            await sgMail.send({
                from: {
                    email: process.env.SENDGRID_FROM_EMAIL,
                    name: "School Space",
                },
                to,
                subject,
                html,
            });
            console.log("✅ Email sent via SendGrid.");
            return { ok: true, provider: "sendgrid" };
        } catch (sgErr) {
            const msg = sgErr?.response?.body?.errors?.[0]?.message || sgErr.message;
            console.error("❌ SendGrid error:", msg);
            // Fall through to SMTP
        }
    } else if (!hasSchoolSMTP && process.env.SENDGRID_API_KEY && !process.env.SENDGRID_FROM_EMAIL) {
        console.warn("⚠️ SENDGRID_API_KEY is set but SENDGRID_FROM_EMAIL is missing. Skipping SendGrid.");
    }

    // ── 2. Nodemailer SMTP (fallback or school-specific) ───────────────────────
    const user = hasSchoolSMTP ? smtpUser : process.env.EMAIL_USER;
    const pass = hasSchoolSMTP ? smtpPass : process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.error("❌ No email provider configured.");
        throw new Error(
            "Email delivery failed: No email provider is configured. " +
            "Please set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL (recommended) " +
            "or EMAIL_USER + EMAIL_PASS in your environment variables."
        );
    }

    if (hasSchoolSMTP) {
        console.log(`🔄 Using school-specific SMTP: ${user}`);
    } else {
        const masked = pass.substring(0, 3) + "****" + pass.substring(pass.length - 3);
        console.log(`🔄 Trying system SMTP fallback: ${user} / ${masked}`);
    }

    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            family: 4, // Force IPv4
            auth: { user, pass },
        });

        const info = await transporter.sendMail({
            from: `"School Space" <${user}>`,
            to,
            subject,
            html,
        });

        console.log("✅ Email sent via SMTP:", info.messageId);
        return info;
    } catch (smtpErr) {
        console.error("❌ SMTP failed:", smtpErr.message);
        throw new Error(`Email delivery failed: ${smtpErr.message}`);
    }
}

/* ================= EMAIL TYPES ================= */

async function sendVerificationEmail(to, code, name, config = {}) {
    return sendEmail({
        to,
        subject: "Verify Your Email - School Space",
        html: `
            <h2>Hello ${name}</h2>
            <p>Your OTP is:</p>
            <h1 style="color:green; letter-spacing:5px">${code}</h1>
            <p>Expires in 5 minutes.</p>
        `,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
    });
}

async function sendResetEmail(to, code, name, config = {}) {
    return sendEmail({
        to,
        subject: "Password Reset Code",
        html: `
            <h2>Hello ${name}</h2>
            <p>Your reset code:</p>
            <h1 style="color:red; letter-spacing:5px">${code}</h1>
        `,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
    });
}

async function sendWelcomeEmail(to, name, schoolId, config = {}) {
    return sendEmail({
        to,
        subject: "Welcome to School Space",
        html: `
            <h2>Welcome ${name} 🎉</h2>
            <p>School ID: ${schoolId || "N/A"}</p>
        `,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
    });
}

async function sendAdminNotification(to, userName, userRole, action, config = {}) {
    return sendEmail({
        to,
        subject: `New ${action} Request`,
        html: `<p>${userRole} <b>${userName}</b> requested ${action}</p>`,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
    });
}

async function sendSchoolCodeEmail(to, schoolCode, firstName, schoolName, config = {}) {
    return sendEmail({
        to,
        subject: "School Code Recovery",
        html: `
            <p>Hello ${firstName}</p>
            <p>School: <b>${schoolName}</b></p>
            <h2>${schoolCode}</h2>
        `,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
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
              <tr><th style="background:#e8f5e9;padding:8px">Strength</th><td style="padding:8px">${swot.strength || "—"}</td></tr>
              <tr><th style="background:#fff3e0;padding:8px">Weakness</th><td style="padding:8px">${swot.weakness || "—"}</td></tr>
              <tr><th style="background:#e3f2fd;padding:8px">Opportunity</th><td style="padding:8px">${swot.opportunity || "—"}</td></tr>
              <tr><th style="background:#fce4ec;padding:8px">Threat</th><td style="padding:8px">${swot.threat || "—"}</td></tr>
              <tr><th style="background:#f3e5f5;padding:8px">Suggestion</th><td style="padding:8px">${swot.suggestion || "—"}</td></tr>
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