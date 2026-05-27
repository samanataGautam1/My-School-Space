require("dotenv").config();
const { Resend } = require('resend');

const nodemailer = require("nodemailer");

const resend = new Resend(process.env.RESEND_API_KEY);

const smtpConfig = {
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

/* ================= CORE SEND FUNCTION ================= */

async function sendEmail({ to, subject, html, smtpUser, smtpPass }) {
    console.log(`📧 Attempting to send email to ${to}...`);

    // 1. Try Resend if API key is present AND custom SMTP is not fully provided
    const hasCustomSMTP = smtpUser && smtpPass;

    if (!hasCustomSMTP && process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_123456789') {
        try {
            const from = process.env.RESEND_FROM_EMAIL || "School Space <onboarding@resend.dev>";
            if (!process.env.RESEND_FROM_EMAIL) {
                console.warn("⚠️  RESEND_FROM_EMAIL missing. Using 'onboarding@resend.dev'. Resend will ONLY send to the account owner in this mode.");
            }
            console.log("📤 Trying Resend...");
            const { data, error } = await resend.emails.send({ from, to, subject, html });

            if (!error) {
                console.log("✅ Email sent via Resend:", data.id);
                return data;
            }
            console.error("❌ Resend error:", JSON.stringify(error));
            if (error?.message?.includes("onboarding")) {
                console.warn("💡 TIP: Verify your domain in Resend or provide SMTP credentials to send to anyone.");
            }
        } catch (resendErr) {
            console.error("❌ Resend attempt failed:", resendErr.message);
        }
    }

    // 2. Fallback to Nodemailer (SMTP)
    const user = hasCustomSMTP ? smtpUser : process.env.EMAIL_USER;
    const pass = hasCustomSMTP ? smtpPass : process.env.EMAIL_PASS;

    if (hasCustomSMTP) {
        console.log(`🔄 Using School-Specific SMTP. User: ${user}, Pass: [PROVIDED]`);
    } else {
        const maskedPass = pass ? (pass.substring(0, 3) + "****" + pass.substring(pass.length - 3)) : 'NONE';
        console.log(`🔄 Using System-Wide SMTP fallback. User: ${user || 'None'}, Pass: ${maskedPass}`);
    }

    try {
        if (!user || !pass) {
            console.error("❌ No SMTP credentials available for fallback.");
            throw new Error("Email delivery configuration missing (No Resend & No SMTP). Please check EMAIL_USER and EMAIL_PASS environment variables.");
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
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
        smtpPass: config.smtpPass
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
        smtpPass: config.smtpPass
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
        smtpPass: config.smtpPass
    });
}

async function sendAdminNotification(to, userName, userRole, action, config = {}) {
    return sendEmail({
        to,
        subject: `New ${action} Request`,
        html: `<p>${userRole} <b>${userName}</b> requested ${action}</p>`,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass
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
        smtpPass: config.smtpPass
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