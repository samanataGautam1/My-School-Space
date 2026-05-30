const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require("../../../prisma/prisma");
const { sendResetEmail, sendAdminNotification, sendStudentResetToParentEmail } = require('../../services/mailer');
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { validatePassword } = require('../../utils/validators');

const router = express.Router();


router.post('/request', async (req, res) => {
  try {
    const { usernameOrEmail, schoolCode } = req.body;

    if (!usernameOrEmail || !schoolCode) {
      return res.status(400).json({ error: 'Username/email and school code are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        school: { code: schoolCode.trim().toUpperCase() }
      },
      include: { school: { select: { id: true, name: true, code: true, email: true, emailPass: true } } }
    });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this username/email and school code combination'
      });
    }

    if (user.role === 'STUDENT') {
      const { parentEmail } = req.body;
      if (!parentEmail) {
        return res.status(400).json({ error: "Parent's email is required for student password recovery." });
      }

      const studentUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          student: {
            include: {
              parent: {
                where: { email: parentEmail.trim() }
              }
            }
          }
        }
      });

      const matchedParents = studentUser?.student?.parent || [];
      if (matchedParents.length === 0) {
        return res.status(400).json({ error: "Parent's email does not match any registered parent for this student." });
      }

      const parent = matchedParents[0];
      const code = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          code: code,
          status: 'ACCEPTED',
          expiresAt: expiresAt
        }
      });

      let emailSent = false;
      try {
        await sendStudentResetToParentEmail(
          parent.email,
          code,
          `${user.firstName} ${user.lastName}`,
          `${parent.firstName} ${parent.lastName}`,
          {
            smtpUser: user.school?.email,
            smtpPass: user.school?.emailPass
          }
        );
        emailSent = true;
      } catch (emailErr) {
        console.error(`Failed to send student reset email to parent ${parent.email}:`, emailErr);
      }

      const response = {
        ok: true,
        message: emailSent
          ? `Verification code has been sent to your parent's email (${parent.email}). Please enter it below.`
          : 'Reset code generated. Please check your parent\'s email or use the code below.',
        requiresApproval: false
      };

      if (process.env.NODE_ENV !== 'production') {
        response.devCode = code;
      }

      return res.json(response);
    }

    // For non-students (ADMIN, TEACHER, PARENT)
    let targetEmail = user.email;
    if (!targetEmail) {
      if (user.role === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
        targetEmail = teacher?.email;
      } else if (user.role === 'PARENT') {
        const parent = await prisma.parent.findUnique({ where: { userId: user.id } });
        targetEmail = parent?.email;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'Your account does not have a registered email. Please contact support.' });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (user.role === 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryCode: code }
      });
    } else {
      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          code: code,
          status: 'ACCEPTED',
          expiresAt: expiresAt
        }
      });
    }

    let emailSent = false;
    try {
      await sendResetEmail(targetEmail, code, user.firstName, {
        smtpUser: user.school?.email,
        smtpPass: user.school?.emailPass
      });
      emailSent = true;
    } catch (emailErr) {
      console.error(`Failed to send reset email to ${targetEmail}:`, emailErr);
    }

    const response = {
      ok: true,
      message: emailSent
        ? `Verification code has been sent to your email (${targetEmail}). Code expires in 15 minutes.`
        : 'Reset code generated. Check your email or use the code below.',
      requiresApproval: false
    };

    if (process.env.NODE_ENV !== 'production') {
      response.devCode = code;
    }

    return res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process password reset request. Please try again.' });
  }
});

/* ================= VERIFY CODE & UPDATE PASSWORD ================= */
router.post('/reset', async (req, res) => {
  try {
    const { usernameOrEmail, schoolCode, code, newPassword } = req.body;

    if (!usernameOrEmail || !schoolCode || !code || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        school: { code: schoolCode.trim().toUpperCase() }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this username/email and school code combination'
      });
    }

    if (user.role === 'ADMIN') {
      if (user.recoveryCode !== code) {
        return res.status(400).json({
          error: 'Invalid verification code. Please check and try again.'
        });
      }

      const hashedPassword = await bcrypt.hash(passwordValidation.value, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, recoveryCode: null }
      });

      return res.json({
        ok: true,
        message: 'Password updated successfully. You can now login with your new password.'
      });
    } else {
      // Check if Admin approved the request
      const request = await prisma.passwordResetRequest.findFirst({
        where: {
          userId: user.id,
          code: code,
          status: 'ACCEPTED',
          isUsed: false,
          expiresAt: { gte: new Date() }
        }
      });

      if (!request) {
        return res.status(400).json({
          error: 'Invalid code, request not approved, or code has expired. Please request a new password reset.'
        });
      }

      const hashedPassword = await bcrypt.hash(passwordValidation.value, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      await prisma.passwordResetRequest.update({
        where: { id: request.id },
        data: { isUsed: true }
      });

      return res.json({
        ok: true,
        message: 'Password updated successfully. You can now login with your new password.'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

/* ================= ADMIN: GET ALL RESET REQUESTS ================= */
router.get('/admin/requests', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const requests = await prisma.passwordResetRequest.findMany({
      where: {
        user: { schoolId: schoolId },
        status: 'PENDING',
        expiresAt: { gte: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ ok: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch password reset requests' });
  }
});

/* ================= ADMIN: APPROVE RESET REQUEST ================= */
router.post('/admin/approve/:id', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.passwordResetRequest.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This request has expired' });
    }

    await prisma.passwordResetRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'ACCEPTED' }
    });

    res.json({
      ok: true,
      message: `Password reset request approved for ${request.user.firstName} ${request.user.lastName}. They can now reset their password using the code.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

/* ================= ADMIN: REJECT RESET REQUEST ================= */
router.post('/admin/reject/:id', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.passwordResetRequest.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.passwordResetRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' }
    });

    res.json({
      ok: true,
      message: `Password reset request rejected for ${request.user.firstName} ${request.user.lastName}.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

module.exports = router;
