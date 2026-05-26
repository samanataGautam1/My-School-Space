const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { sendResetEmail, sendAdminNotification } = require('../../services/mailer');
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { validatePassword } = require('../../utils/validators');

const prisma = new PrismaClient();
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
      include: { school: { select: { id: true, name: true, code: true } } }
    });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this username/email and school code combination'
      });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (user.role === 'ADMIN') {
      if (!user.email) {
        return res.status(400).json({
          error: 'Admin email not set. Please contact support.'
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryCode: code }
      });

      let emailSent = false;
      try {
        await sendResetEmail(user.email, code, user.firstName, user.schoolId);
        emailSent = true;
      } catch (emailErr) {
        // Email failed but code is saved — user can still reset
      }

      const response = {
        ok: true,
        message: emailSent
          ? 'Verification code sent to your email. Code expires in 15 minutes.'
          : 'Reset code generated. Check your email or use the code below.',
        requiresApproval: false
      };

      // In development, include the code so testing works without SMTP
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = code;
      }

      return res.json(response);
    } else {
      // Create a request for admin approval
      // In dev mode, auto-approve so testing works without admin intervention
      const isDev = process.env.NODE_ENV !== 'production';

      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          code: code,
          status: isDev ? 'ACCEPTED' : 'PENDING',
          expiresAt: expiresAt
        }
      });

      // Try to notify admin (don't crash if email fails)
      try {
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN', schoolId: user.schoolId }
        });
        if (admin && admin.email) {
          await sendAdminNotification(
            admin.email,
            `${user.firstName} ${user.lastName}`,
            user.role,
            'password reset',
            user.schoolId
          );
        }
      } catch {
        // Email notification failed — not critical
      }

      const response = {
        ok: true,
        message: isDev
          ? 'Reset code generated. Enter the code below to set your new password.'
          : 'Password reset request sent to your school administrator for approval.',
        requiresApproval: !isDev
      };

      if (isDev) {
        response.devCode = code;
      }

      return res.json(response);
    }
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
