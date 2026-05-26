const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, html) {
  try {
    const result = await resend.emails.send({
      from: "School Space <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    return result;
  } catch (err) {
    console.error("Email error:", err);
    throw err;
  }
}

module.exports = sendEmail;