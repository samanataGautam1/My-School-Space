require("dotenv").config();
const { Resend } = require('resend');

const nodemailer = require("nodemailer");
const dns = require("dns");

// 🌐 Force Node.js to prefer IPv4 over IPv6. 
// This fixes the 'ENETUNREACH' error on networks with broken IPv6 routing.
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

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

    const hasCustomSMTP = smtpUser && smtpPass;
    const user = hasCustomSMTP ? smtpUser : process.env.EMAIL_USER;
    const pass = hasCustomSMTP ? smtpPass : process.env.EMAIL_PASS;

    // 1. Try Nodemailer (SMTP) First - More reliable for universal delivery
    if (user && pass) {
        if (hasCustomSMTP) {
            console.log(`🔄 Using School-Specific SMTP. User: ${user}, Pass: [PROVIDED]`);
        } else {
            const maskedPass = pass.substring(0, 3) + "****" + pass.substring(pass.length - 3);
            console.log(`🔄 Using System-Wide SMTP primary. User: ${user}, Pass: ${maskedPass}`);
        }

        try {
            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                family: 4,
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
            console.error("❌ SMTP attempt failed:", smtpErr.message);
            // If SMTP fails, we'll try Resend as a fallback below
        }
    } else {
        console.warn("⚠️ No SMTP credentials available. Skipping SMTP.");
    }

    // 2. Fallback to Resend
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_123456789') {
        try {
            const from = process.env.RESEND_FROM_EMAIL || "School Space <onboarding@resend.dev>";
            console.log("📤 Trying Resend fallback...");
            const { data, error } = await resend.emails.send({ from, to, subject, html });

            if (!error) {
                console.log("✅ Email sent via Resend:", data.id);
                return data;
            }
            console.error("❌ Resend error:", JSON.stringify(error));
        } catch (resendErr) {
            console.error("❌ Resend fallback failed:", resendErr.message);
        }
    }

    throw new Error("Email delivery failed: Both SMTP and Resend systems are unavailable or failed.");
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