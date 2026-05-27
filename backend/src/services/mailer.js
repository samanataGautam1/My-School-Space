require("dotenv").config();
const nodemailer = require("nodemailer");
const dns = require("dns");
const sgMail = require("@sendgrid/mail");

// 🌐 Force Node.js to prefer IPv4 over IPv6. 
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// 📧 Initialize SendGrid as the GLOBAL primary provider
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Sends an email using:
 * 1. SendGrid API (PRIORITY FOR ALL PRODUCTION EMAILS)
 * 2. Resend API
 * 3. Nodemailer SMTP (Fallback)
 */
async function sendEmail(...args) {
    let to, subject, html, smtpUser, smtpPass;

    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        // New object-based pattern: sendEmail({ to, subject, html, ... })
        ({ to, subject, html, smtpUser, smtpPass } = args[0]);
    } else {
        // Legacy positional pattern: sendEmail(to, subject, html, smtpUser, smtpPass)
        [to, subject, html, smtpUser, smtpPass] = args;
    }

    console.log(`📧 Attempting to send email to ${to}...`);

    // --- 1. TRY SENDGRID (PRIMARY FOR ALL) ---
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        try {
            console.log("📤 Trying SendGrid...");
            await sgMail.send({
                from: {
                    email: process.env.SENDGRID_FROM_EMAIL,
                    name: "School Space"
                },
                to,
                subject,
                html,
            });
            console.log("✅ Email sent via SendGrid.");
            return { success: true, provider: 'sendgrid' };
        } catch (sgErr) {
            console.error("❌ SendGrid error:", sgErr.message);
        }
    }

    // --- 2. TRY RESEND (Fallback 1) ---
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_123456789') {
        try {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const from = process.env.RESEND_FROM_EMAIL || "School Space <onboarding@resend.dev>";
            console.log("📤 Trying Resend...");
            const { data, error } = await resend.emails.send({ from, to, subject, html });
            if (!error) {
                console.log("✅ Email sent via Resend:", data.id);
                return data;
            }
            console.error("❌ Resend error:", JSON.stringify(error));
        } catch (resendErr) {
            console.error("❌ Resend attempt failed:", resendErr.message);
        }
    }

    // --- 3. TRY NODEMAILER SMTP (ULTIMATE FALLBACK) ---
    const user = smtpUser || process.env.EMAIL_USER;
    const pass = smtpPass || process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.error("❌ No email credentials available (SendGrid failed and no SMTP set).");
        throw new Error("Email delivery failed: please check your SendGrid or SMTP configuration.");
    }

    try {
        console.log(`🔄 Trying SMTP. User: ${user}`);
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

/**
 * Sends a complaint/notice from a teacher to a parent.
 */
async function sendTeacherComplaintEmail(to, parentName, teacherName, studentName, subject, body, schoolId) {
    return sendEmail({
        to,
        subject: `Notice: ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #d32f2f;">Official Notice for ${studentName}</h2>
                <p>Hello <b>${parentName}</b>,</p>
                <p>You have received an official notice from <b>${teacherName}</b> regarding your child, <b>${studentName}</b>.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <div style="background: #fdfdfd; padding: 15px; border-left: 4px solid #d32f2f; margin-bottom: 20px;">
                    <h3 style="margin-top: 0;">Subject: ${subject}</h3>
                    <p style="white-space: pre-wrap;">${body}</p>
                </div>
                <p style="font-size: 0.9em; color: #666;">Please log in to the School Space portal for more details or to respond.</p>
            </div>
        `
    });
}

/**
 * Sends a final session report email to a parent.
 */
async function sendFinalSessionReportEmail(to, parentName, studentName, reportData, schoolId) {
    return sendEmail({
        to,
        subject: `${reportData.session} Report for ${studentName}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>${reportData.session} Performance Summary</h2>
                <p>Hello <b>${parentName}</b>,</p>
                <p>The performance report for <b>${studentName}</b> for <b>${reportData.session} (${reportData.year})</b> has been published.</p>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><b>Overall Percentage:</b> ${Math.round(reportData.totalPercentage)}%</p>
                    <p><b>Attendance:</b> ${Math.round(reportData.attendancePercentage)}%</p>
                    <p><b>Exam Average:</b> ${Math.round(reportData.examAverage)}%</p>
                    <p><b>Teacher:</b> ${reportData.teacherName}</p>
                </div>
                <p>You can view the detailed analytics and SWOT reports in your parent dashboard.</p>
            </div>
        `
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
    sendTeacherComplaintEmail,
    sendFinalSessionReportEmail,
};