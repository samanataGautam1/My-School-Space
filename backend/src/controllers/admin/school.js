const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { sendSchoolCodeEmail } = require('../../services/mailer');
const { authMiddleware, allowRoles } = require('../../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

/* ================= REQUEST SCHOOL CODE RECOVERY ================= */
router.post('/request', async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) return res.status(400).json({ error: 'usernameOrEmail required' });

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
      },
      include: {
        school_school_adminIdTouser: { select: { id: true, name: true, code: true } }
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'STUDENT') return res.status(403).json({ error: 'Not valid for students' });

    let schoolCode = null;
    if (user.role === 'ADMIN') {
      schoolCode = user.school_school_adminIdTouser?.code || null;
      if (!schoolCode || !user.email) {
        return res.status(400).json({ error: 'Admin school/email not set' });
      }
      await sendSchoolCodeEmail(user.email, schoolCode);
      return res.json({ ok: true, message: 'School code sent to admin email' });
    } else {
      // For TEACHER/PARENT: create a request for Admin approval
      const schoolId = user.schoolId;
      if (!schoolId || !user.email) {
        return res.status(400).json({ error: 'User school/email not set' });
      }

      const code = `SCODE-${crypto.randomInt(100000, 999999)}`;

      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          code,
          status: 'PENDING'
        }
      });
      return res.json({ ok: true, message: 'Request sent to Admin for approval' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to request school code' });
  }
});

/* ================= ADMIN: LIST SCHOOL CODE REQUESTS ================= */
router.get('/recover/admin/requests', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const requests = await prisma.passwordResetRequest.findMany({
      where: {
        status: 'PENDING',
        user: { schoolId }
      },
      include: { user: true }
    });

    const filtered = requests.filter(r => r.code && r.code.startsWith('SCODE-'));
    res.json({ ok: true, data: filtered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/* ================= ADMIN: APPROVE SCHOOL CODE REQUEST ================= */
router.post('/recover/admin/approve/:id', authMiddleware, allowRoles('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const reqRecord = await prisma.passwordResetRequest.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });
    if (!reqRecord) return res.status(404).json({ error: 'Request not found' });
    if (!reqRecord.code || !reqRecord.code.startsWith('SCODE-')) {
      return res.status(400).json({ error: 'Not a school code request' });
    }

    const school = await prisma.school.findUnique({
      where: { id: reqRecord.user.schoolId },
      select: { id: true, code: true }
    });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (!reqRecord.user.email) return res.status(400).json({ error: 'User email not set' });

    await prisma.passwordResetRequest.update({
      where: { id: reqRecord.id },
      data: { status: 'ACCEPTED', isUsed: true }
    });

    await sendSchoolCodeEmail(reqRecord.user.email, school.code);
    res.json({ ok: true, message: 'School code sent to user email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

module.exports = router;

