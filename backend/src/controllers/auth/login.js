const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  try {
    let { usernameOrCode, password } = req.body;

    if (usernameOrCode) {
      usernameOrCode = usernameOrCode.trim().toLowerCase();
    }

    console.log(`[LOGIN] Attempt: user='${usernameOrCode}', passLen=${password ? password.length : 0}`);


    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      console.error('DATABASE CONNECTION ERROR:', dbError);
      return res.status(500).json({ error: 'Database connection failed. Please contact administrator.' });
    }

    if (!usernameOrCode || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrCode },
          { email: usernameOrCode },
          { student: { studentCode: usernameOrCode } }
        ]
      },
      include: {
        school_school_adminIdTouser: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            ratingsEnabled: true,
            activePerformanceSession: true,
            activePerformanceYear: true,
            parentMessagingEnabled: true,
            multiClassTeachersEnabled: true,
            studentAnalyticsEnabled: true
          }
        },
        teacher: {
          include: {
            teachersubject: { include: { subject: true, Renamedclass: true } },
            Renamedclass_classteachers: true
          }
        },
        student: true,
        parent: { include: { student: true } }
      }
    });

    if (!user) {
      console.log(`[LOGIN] User not found: '${usernameOrCode}'`);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    let schoolId = null;
    let targetSchool = null;

    switch (user.role) {
      case 'ADMIN':
        schoolId = user.school_school_adminIdTouser?.id;
        targetSchool = user.school_school_adminIdTouser;
        break;

      case 'TEACHER':
        schoolId = user.teacher?.schoolId;
        break;

      case 'STUDENT':
        schoolId = user.student?.schoolId;
        break;

      case 'PARENT':
        schoolId = user.parent?.schoolId;
        break;
    }

    if (schoolId) {
      targetSchool = await prisma.school.findUnique({
        where: { id: schoolId }
      });
    }


    if (user.lockoutUntil && new Date() < user.lockoutUntil) {
      const minutesLeft = Math.ceil((user.lockoutUntil - new Date()) / 60000);
      return res.status(403).json({
        error: `Account temporarily locked due to multiple failed attempts. Please try again in ${minutesLeft} minutes.`
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      const newFailedAttempts = (user.failedAttempts || 0) + 1;
      let lockoutUntil = user.lockoutUntil;

      if (newFailedAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockoutUntil
        }
      });

      console.log(`[LOGIN] Password mismatch for user '${user.username}', attempts=${newFailedAttempts}`);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockoutUntil: null
      }
    });

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified. Please verify your email to login.',
        requiresVerification: true,
        email: user.email // Send email back so frontend can redirect/prefill
      });
    }

    switch (user.role) {
      case 'ADMIN':
        break;

      case 'TEACHER':

        const teacherStatus = (user.teacher?.status || 'PENDING').toString().toUpperCase();

        if (teacherStatus === 'PENDING') {
          return res.status(403).json({
            error: 'Your registration is yet to be verified by admin. Please wait for approval.',
            status: 'PENDING'
          });
        }

        if (teacherStatus === 'REJECTED') {
          return res.status(403).json({
            error: 'Your registration has been rejected by the admin. Please contact the respective management.',
            status: 'REJECTED'
          });
        }

        if (targetSchool?.adminId) {

          const directClasses = user.teacher?.Renamedclass_classteachers || [];
          const subjectClasses = user.teacher?.teachersubject?.map(ts => ts.Renamedclass).filter(Boolean) || [];

          const allClasses = [...directClasses, ...subjectClasses];

          const uniqueClasses = Array.from(new Map(allClasses.map(item => [item.id, item])).values());

          const classNames = uniqueClasses.length > 0
            ? uniqueClasses.map(c => c.name).join(', ')
            : 'N/A';

          const subjectNames = user.teacher.teachersubject.length > 0
            ? [...new Set(user.teacher.teachersubject.map(s => s.subject.name))].join(', ')
            : 'N/A';

          await prisma.notification.create({
            data: {
              schoolId: schoolId,
              adminId: targetSchool.adminId,
              message: `Teacher ${user.firstName} ${user.lastName} logged in | Subjects: ${subjectNames} | Classes: ${classNames}`
            }
          });
        }
        break;

      case 'STUDENT':
        if (!user.student.isApproved) {
          return res.status(403).json({
            error: "Your account is pending approval by your Class Head. Please contact them or wait for verification.",
            status: 'PENDING'
          });
        }
        break;
      case 'PARENT':

        if (user.parent) {

          const children = await prisma.student.findMany({
            where: {
              parent: {
                some: {
                  id: user.parent.id
                }
              }
            },
            include: { Renamedclass: true }
          });

          user.students = children.map(s => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            studentCode: s.studentCode,
            className: s.Renamedclass
              ? `${s.Renamedclass.name}${s.Renamedclass.section}`
              : 'N/A'
          }));

        } else {
          user.students = [];
        }

        break;

      default:
        return res.status(403).json({ error: 'Invalid role' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        schoolId: schoolId || null,
        studentId: user.student?.id || null,
        teacherId: user.teacher?.id || null,
        parentId: user.parent?.id || null
      },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        schoolId,
        students: user.students || [],
        student: user.student,
        teacher: user.teacher ? { status: user.teacher.status } : null
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
