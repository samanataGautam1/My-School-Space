const express = require('express');
const path = require('path');
const prisma = require("../../../prisma/prisma");
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { finalizeSessionAssignments } = require('../teacher/performanceHelper');
const { getNextSession } = require(path.join(__dirname, 'sessionDates.js'));
const mailer = require('../../services/mailer');
const { getGradeFromMarks, evaluateSubjectResult, calculateOverallGPA, getGradeTable } = require('../../utils/nepalGrading');
const NT = require('../../utils/notificationTypes');

const router = express.Router();

// NOTE: one-time data seeding was here, moved to a migration script.

/* ================= ALL ROUTES PROTECTED ================= */
router.use(authMiddleware, allowRoles('ADMIN'));

// Get Detailed Class Info (Students, Parents, Teachers)
router.get('/classes/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = await getAdminSchoolId(req.user.userId);
    const classId = parseInt(id);

    // 1. Fetch Students
    const students = await prisma.student.findMany({
      where: { classId, schoolId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });

    // 2. Fetch Parents
    const parents = await prisma.parent.findMany({
      where: {
        student: {
          some: { classId, schoolId }
        }
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        student: {
          where: { classId, schoolId },
          select: { firstName: true, lastName: true }
        }
      }
    });

    // 3. Fetch Teachers
    const teachingAssignments = await prisma.teachersubject.findMany({
      where: { classId },
      include: {
        teacher: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } }
        },
        subject: true
      }
    });

    const classObj = await prisma.renamedclass.findUnique({
      where: { id: classId },
      include: {
        teacher_Renamedclass_classHeadIdToteacher: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } }
        }
      }
    });

    if (!classObj) return res.status(404).json({ error: "Class not found" });

    const teacherMap = new Map();
    teachingAssignments.forEach(ts => {
      if (!teacherMap.has(ts.teacherId)) {
        teacherMap.set(ts.teacherId, {
          id: ts.teacherId,
          name: `${ts.teacher.user.firstName} ${ts.teacher.user.lastName}`,
          email: ts.teacher.user.email,
          subjects: [],
          isClassTeacher: classObj.classHeadId === ts.teacherId
        });
      }
      teacherMap.get(ts.teacherId).subjects.push(ts.subject.name);
    });

    if (classObj.teacher_Renamedclass_classHeadIdToteacher && !teacherMap.has(classObj.classHeadId)) {
      const head = classObj.teacher_Renamedclass_classHeadIdToteacher;
      teacherMap.set(classObj.classHeadId, {
        id: classObj.classHeadId,
        name: `${head.user.firstName} ${head.user.lastName}`,
        email: head.user.email,
        subjects: [],
        isClassTeacher: true
      });
    }

    res.json({
      ok: true,
      data: {
        students: students.map(s => ({
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          studentCode: s.studentCode
        })),
        parents: parents.map(p => ({
          id: p.id,
          parentName: `${p.user.firstName} ${p.user.lastName}`,
          email: p.user.email,
          studentName: p.student.map(s => `${s.firstName} ${s.lastName}`).join(", ")
        })),
        teachers: Array.from(teacherMap.values())
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Broadcast School Notice (to all parents/students)
router.post('/broadcast-notice', async (req, res) => {
  try {
    const { message, priority = 'NORMAL' } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);
    const adminId = Number(req.user.userId);

    if (!message) return res.status(400).json({ error: "Message is required" });

    const notification = await prisma.notification.create({
      data: {
        schoolId,
        adminId,
        message,
        type: NT.ADMIN_NOTICE,
        isRead: false
      }
    });

    res.json({ ok: true, data: notification });
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast notice' });
  }
});

// Get Admin Notifications
router.get('/notifications', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const notifications = await prisma.notification.findMany({
      where: { schoolId, adminId: Number(req.user.userId) },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ ok: true, data: notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark Notifications Read
router.patch('/notifications/read', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    await prisma.notification.updateMany({
      where: { schoolId, adminId: Number(req.user.userId), isRead: false },
      data: { isRead: true }
    });
    res.json({ ok: true, message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

/* ================= HELPER: GET ADMIN SCHOOL ID ================= */
async function getAdminSchoolId(adminId) {
  if (!adminId) {
    throw new Error('Invalid Admin ID in token');
  }

  const school = await prisma.school.findUnique({
    where: { adminId: parseInt(adminId) },
    select: { id: true, name: true, adminId: true }
  });

  if (!school) {
    throw new Error(`Admin school not found for User ID ${adminId}`);
  }
  return school.id;
}

/* ================= STUDENT MANAGEMENT ================= */
router.get('/students', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { name, className } = req.query;

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        AND: [
          name ? {
            OR: [
              { firstName: { contains: name } },
              { lastName: { contains: name } }
            ]
          } : {},
          className ? { Renamedclass: { name: { contains: className } } } : {}
        ]
      },
      include: {
        user: true,
        Renamedclass: true
      }
    });

    const formatted = students.map(s => ({
      id: s.id,
      userId: s.userId,
      studentCode: s.studentCode,
      rollNo: s.rollNo,
      firstName: s.firstName,
      lastName: s.lastName,
      name: `${s.firstName} ${s.lastName}`,
      className: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section || ''}` : 'N/A',
      username: s.user.username,
      email: s.user.email
    }));

    res.json({ ok: true, data: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

/* ================= DASHBOARD OVERVIEW ================= */
router.get('/overview', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { session, year } = req.query;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        address: true,
        phone: true,
        logoUrl: true,
        ratingsEnabled: true,
        activePerformanceSession: true,
        activePerformanceYear: true,
        parentMessagingEnabled: true,
        multiClassTeachersEnabled: true,
        studentAnalyticsEnabled: true
      }
    });
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    const filterSession = (session && session !== 'ALL') ? session : (session === 'ALL' ? null : school.activePerformanceSession);
    const filterYear = year ? parseInt(year) : (school.activePerformanceYear || new Date().getFullYear());

    const [teacherCount, studentCount, parentCount, classesForStats, allTeachersWithRatings, recentMessages] = await Promise.all([
      prisma.teacher.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId } }),
      prisma.parent.count({ where: { schoolId } }),
      prisma.renamedclass.findMany({
        where: { schoolId },
        select: { name: true, section: true, _count: { select: { student: true } } },
        orderBy: { name: 'asc' }
      }),
      prisma.teacher.findMany({
        where: { schoolId },
        include: {
          user: { select: { firstName: true, lastName: true } },
          rating: {
            where: filterSession ? {
              session: { contains: filterSession.trim() },
              sessionYear: filterYear
            } : {},
          }
        }
      }),
      prisma.message.findMany({
        where: { user_message_fromUserIdTouser: { schoolId } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user_message_fromUserIdTouser: { select: { firstName: true, lastName: true, role: true } } }
      })
    ]);

    const rankedTeachers = allTeachersWithRatings
      .map(t => {
        const total = (t.rating || []).reduce((sum, r) => sum + r.score, 0);
        const avg = (t.rating || []).length ? total / t.rating.length : 0;
        return {
          id: t.id,
          name: t.user ? `${t.user.firstName} ${t.user.lastName}` : 'Unknown Teacher',
          averageRating: Number(avg.toFixed(1)),
          totalReviews: (t.rating || []).length,
          initial: t.user && t.user.firstName ? t.user.firstName[0] : '?'
        };
      })
      .filter(t => t.totalReviews > 0)
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 5);

    res.json({
      ok: true,
      data: {
        school: {
          ...school,
          activeRatingSession: school.activePerformanceSession,
          activeRatingYear: school.activePerformanceYear
        },
        stats: {
          teachers: teacherCount,
          students: studentCount,
          parents: parentCount,
          classes: classesForStats.length,
          activeRatingYear: school.activePerformanceYear,
          filterSession: filterSession || 'ALL',
          filterYear: filterYear,
          studentDistribution: classesForStats
            .map(c => ({ name: `${c.name}${c.section || ''}`, value: c._count.student }))
            .filter(c => c.value > 0)
        },
        topTeachers: rankedTeachers,
        recentMessages: recentMessages.map(msg => ({
          id: msg.id,
          from: msg.user_message_fromUserIdTouser ? `${msg.user_message_fromUserIdTouser.firstName} ${msg.user_message_fromUserIdTouser.lastName}` : 'Unknown',
          subject: msg.subject,
          body: msg.body,
          status: msg.status,
          createdAt: msg.createdAt
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message, details: err.message });
  }
});

/* ================= FINANCIAL STATS ================= */
router.get('/dashboard/financial-stats', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { period = 'This Month' } = req.query;

    const now = new Date();
    let startDate;
    let lastMonthStart;
    let lastMonthEnd;

    if (period === 'This Month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'Last Month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      lastMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    } else if (period === 'Yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      lastMonthStart = new Date(now.getFullYear() - 1, 0, 1);
      lastMonthEnd = new Date(now.getFullYear() - 1, 11, 31);
    }

    const [collected, lastMonthCollected, pending, studentCount, recentTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { student: { schoolId }, date: { gte: startDate } },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { student: { schoolId }, date: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amount: true }
      }),
      prisma.fee.aggregate({
        where: { student: { schoolId }, status: 'PENDING' },
        _sum: { amount: true }
      }),
      prisma.student.count({ where: { schoolId } }),
      prisma.transaction.findMany({
        where: { student: { schoolId } },
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              Renamedclass: { select: { name: true, section: true } }
            }
          }
        }
      })
    ]);

    const target = studentCount * 5000;

    res.json({
      ok: true,
      data: {
        summary: {
          collected: collected._sum.amount || 0,
          pending: pending._sum.amount || 0,
          target: target || 500000,
          lastMonth: lastMonthCollected._sum.amount || 0
        },
        recentTransactions: recentTransactions.map(tx => ({
          id: tx.id,
          student: `${tx.student.firstName} ${tx.student.lastName}`,
          class: tx.student.Renamedclass ? `${tx.student.Renamedclass.name}${tx.student.Renamedclass.section || ''}` : "N/A",
          amount: tx.amount,
          status: "PAID",
          date: tx.date,
          type: "Fee Payment"
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= TEACHERS ================= */
router.get('/teachers-by-class', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const teachers = await prisma.teacher.findMany({
      where: { schoolId, user: { emailVerified: true } },
      include: {
        user: true,
        Renamedclass_classteachers: true,
        Renamedclass_Renamedclass_classHeadIdToteacher: true,
        teachersubject: { include: { subject: true, Renamedclass: true } }
      }
    });

    const result = teachers.map(t => {
      const subjectClasses = t.teachersubject.map(s => s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section || ''}` : null).filter(Boolean);
      const directClasses = t.Renamedclass_classteachers.map(c => `${c.name}${c.section || ''}`);
      const allClasses = [...new Set([...directClasses, ...subjectClasses])];

      const headClass = t.Renamedclass_Renamedclass_classHeadIdToteacher;

      return {
        id: t.id,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        name: `${t.user.firstName} ${t.user.lastName}`,
        email: t.user.email,
        subjects: [...new Set(t.teachersubject.map(s => s.subject.name))],
        classes: allClasses,
        status: t.status,
        isActive: t.user.isActive,
        isClassTeacher: t.isClassTeacher,
        headOfClass: headClass ? `${headClass.name}${headClass.section || ''}` : null,
        headOfClassId: headClass ? headClass.id : null
      };
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= TEACHER RATINGS ================= */
router.get('/teacher-ratings', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { session } = req.query;
    const sessionLower = session ? session.trim().toLowerCase() : null;

    const teachers = await prisma.teacher.findMany({
      where: { schoolId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        rating: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            subject: true,
            Renamedclass: true
          },
          orderBy: { createdAt: 'desc' }
        },
        teachersubject: { include: { subject: true, Renamedclass: true } },
        Renamedclass_classteachers: true
      }
    });

    const formatted = teachers.map(t => {
      const filteredRatings = sessionLower && sessionLower !== 'all'
        ? t.rating.filter(r => r.session && r.session.toLowerCase().includes(sessionLower))
        : t.rating;

      const totalScore = filteredRatings.reduce((acc, r) => acc + r.score, 0);
      return {
        id: t.id,
        name: `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim(),
        initial: t.user?.firstName?.[0] || '?',
        stats: {
          avgRating: filteredRatings.length > 0 ? (totalScore / filteredRatings.length).toFixed(1) : "0.0",
          totalReviews: filteredRatings.length
        },
        teachingSubjects: (t.teachersubject || []).map(s => ({
          subjectId: s.subjectId,
          subjectName: s.subject?.name || 'Unknown',
          classId: s.classId,
          className: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section || ''}` : 'N/A'
        })),
        ratings: filteredRatings.map(r => ({
          id: r.id,
          score: r.score,
          review: r.review,
          date: r.createdAt,
          session: r.session,
          subjectId: r.subjectId,
          classId: r.classId,
          subjectName: r.subject?.name || 'General',
          studentName: r.student?.user ? `${r.student.user.firstName} ${r.student.user.lastName}` : 'Unknown',
          className: r.Renamedclass ? `${r.Renamedclass.name}${r.Renamedclass.section || ''}` : 'N/A'
        }))
      };
    });
    res.json({ ok: true, data: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed', detail: err.message });
  }
});

/* ================= REVIEWS ================= */
router.get('/reviews', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { className } = req.query;

    const ratings = await prisma.rating.findMany({
      where: {
        teacher: { schoolId },
        AND: [className ? { Renamedclass: { name: { contains: className } } } : {}]
      },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        subject: true,
        Renamedclass: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      ok: true, data: ratings.map(r => ({
        id: r.id,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
        score: r.score,
        review: r.review,
        class: r.Renamedclass ? `${r.Renamedclass.name}${r.Renamedclass.section}` : 'N/A'
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= CLASSES ================= */
router.get('/classes', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const classes = await prisma.renamedclass.findMany({
      where: { schoolId },
      include: {
        _count: {
          select: { student: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const classIds = classes.map(c => c.id);

    // Batch-fetch parent counts per class (single query, no N+1)
    const parentsWithStudents = await prisma.parent.findMany({
      where: { student: { some: { classId: { in: classIds }, schoolId } } },
      select: {
        id: true,
        student: { where: { classId: { in: classIds }, schoolId }, select: { classId: true } }
      }
    });
    const parentCountByClass = {};
    for (const p of parentsWithStudents) {
      for (const s of p.student) {
        if (s.classId) {
          if (!parentCountByClass[s.classId]) parentCountByClass[s.classId] = new Set();
          parentCountByClass[s.classId].add(p.id);
        }
      }
    }

    const enrichedClasses = classes.map(cls => ({
      ...cls,
      studentCount: cls._count.student,
      parentCount: parentCountByClass[cls.id] ? parentCountByClass[cls.id].size : 0
    }));

    res.json({ ok: true, data: enrichedClasses });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/classes/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = await getAdminSchoolId(req.user.userId);
    const students = await prisma.student.findMany({
      where: { schoolId, classId: parseInt(id) },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        Renamedclass: { select: { name: true, section: true } }
      }
    });

    res.json({
      ok: true, data: students.map(s => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        className: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section}` : 'N/A'
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= SETTINGS ================= */
router.patch("/settings/ratings", async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { enabled, session, year } = req.body;

    const oldSchool = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true }
    });

    await prisma.school.update({
      where: { id: schoolId },
      data: {
        ratingsEnabled: enabled,
        activePerformanceSession: enabled ? session : null,
        activePerformanceYear: enabled ? parseInt(year) : null
      }
    });

    if (enabled && session && oldSchool?.activePerformanceSession !== session) {
      const teachers = await prisma.teacher.findMany({
        where: { schoolId },
        select: { id: true }
      });

      // Notify teachers individually
      const teacherNotifications = teachers.map(t => ({
        teacherId: t.id,
        message: `${session} started. Prepare the graph and calculations.`,
        type: NT.INFO,
        isRead: false,
        schoolId
      }));

      // Broadcast to students (studentId and adminId both null in student route logic)
      const studentBroadcast = {
        message: `Teacher Rating for ${session} (${year}) is now open! Please rate your teachers.`,
        type: "SESSION_STARTED",
        isRead: false,
        schoolId
      };

      if (teacherNotifications.length > 0) {
        await prisma.notification.createMany({
          data: [...teacherNotifications, studentBroadcast]
        });
      } else {
        await prisma.notification.create({ data: studentBroadcast });
      }
    }

    res.json({ ok: true, message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get("/settings", async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { ratingsEnabled: true, activePerformanceSession: true, activePerformanceYear: true }
    });
    res.json({ ok: true, data: school });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { parentMessagingEnabled, multiClassTeachersEnabled, studentAnalyticsEnabled, ratingsEnabled, activePerformanceSession, activePerformanceYear } = req.body;
    await prisma.school.update({
      where: { id: schoolId },
      data: { parentMessagingEnabled, multiClassTeachersEnabled, studentAnalyticsEnabled, ratingsEnabled, activePerformanceSession, activePerformanceYear }
    });
    res.json({ ok: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/* ================= SCHOOL IDENTITY ================= */
router.patch("/school-identity", async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { name, email, address, phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'School name is required' });
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null
      }
    });
    res.json({ ok: true, message: 'School identity updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update school identity' });
  }
});

/* ================= MESSAGES (APPROVAL FLOW) ================= */
router.get('/messages/requests', async (req, res) => {
  try {
    const adminId = parseInt(req.user.userId);
    const requests = await prisma.message.findMany({
      where: { toUserId: adminId },
      include: {
        user_message_fromUserIdTouser: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    // Batch-fetch parent records for all PARENT senders (no N+1)
    const parentSenderIds = requests
      .filter(m => m.user_message_fromUserIdTouser?.role === 'PARENT')
      .map(m => m.fromUserId)
      .filter(Boolean);
    const parentRecords = parentSenderIds.length > 0
      ? await prisma.parent.findMany({
        where: { userId: { in: parentSenderIds } },
        include: { student: { select: { firstName: true, lastName: true } } }
      })
      : [];
    const parentByUserId = {};
    for (const p of parentRecords) {
      parentByUserId[p.userId] = p;
    }

    const formatted = requests.map(m => {
      let studentInfo = '';
      if (m.user_message_fromUserIdTouser?.role === 'PARENT') {
        const parentRecord = parentByUserId[m.fromUserId];
        if (parentRecord && parentRecord.student.length > 0) {
          studentInfo = parentRecord.student.map(s => `${s.firstName} ${s.lastName}`).join(", ");
        }
      }
      return {
        id: m.id,
        fromUserId: m.fromUserId || m.user_message_fromUserIdTouser?.id,
        from: m.user_message_fromUserIdTouser ? `${m.user_message_fromUserIdTouser.firstName} ${m.user_message_fromUserIdTouser.lastName}` : 'Unknown',
        subject: m.subject,
        body: m.body,
        status: m.status,
        studentInfo: studentInfo,
        createdAt: m.createdAt
      };
    });

    res.json({ ok: true, data: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/messages/:id/accept', async (req, res) => {
  try {
    const adminId = parseInt(req.user.userId);
    const msg = await prisma.message.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!msg || msg.toUserId !== adminId) return res.status(404).json({ error: 'Message not found' });
    await prisma.message.update({ where: { id: msg.id }, data: { status: 'ACCEPTED' } });
    res.json({ ok: true, message: 'Message accepted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/messages/:id/reject', async (req, res) => {
  try {
    const adminId = parseInt(req.user.userId);
    const msg = await prisma.message.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!msg || msg.toUserId !== adminId) return res.status(404).json({ error: 'Message not found' });
    await prisma.message.update({ where: { id: msg.id }, data: { status: 'REJECTED' } });
    res.json({ ok: true, message: 'Message rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/messages/:id', async (req, res) => {
  try {
    const adminId = parseInt(req.user.userId);
    const msg = await prisma.message.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!msg || msg.toUserId !== adminId) return res.status(404).json({ error: 'Message not found' });
    await prisma.message.delete({ where: { id: msg.id } });
    res.json({ ok: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/messages/conversation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = parseInt(req.user.userId);
    const schoolId = await getAdminSchoolId(req.user.userId);

    // Verify the other user belongs to this admin's school
    const otherUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { schoolId: true }
    });
    if (!otherUser || otherUser.schoolId !== schoolId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: parseInt(userId), toUserId: adminId },
          { fromUserId: adminId, toUserId: parseInt(userId) }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ ok: true, data: messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Multer for message file attachments
const multer = require('multer');
const msgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = require('path').join(__dirname, '../../uploads/messages');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = require('path').extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const uploadMsgFile = multer({ storage: msgStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

router.post('/messages/reply', uploadMsgFile.single('file'), async (req, res) => {
  try {
    const { toUserId, subject, body } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'Recipient (toUserId) is required' });
    }

    const recipientId = parseInt(toUserId);
    if (isNaN(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient ID' });
    }

    await prisma.message.create({
      data: {
        fromUserId: parseInt(req.user.userId),
        toUserId: recipientId,
        subject: subject || "Reply from Admin",
        body: body || '',
        status: 'ACCEPTED'
      }
    });

    res.json({ ok: true, message: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
});

// Alias
router.post('/messages/send', uploadMsgFile.single('file'), async (req, res) => {
  res.redirect(307, '/api/admin/messages/reply');
});

/* ================= TEACHER APPROVAL ================= */
router.get('/pending-teachers', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const pending = await prisma.teacher.findMany({
      where: { schoolId, status: 'PENDING' },
      include: {
        user: true,
        teachersubject: {
          include: {
            subject: true,
            Renamedclass: true
          }
        },
        Renamedclass_Renamedclass_classHeadIdToteacher: true // The class where this teacher is Head
      }
    });
    res.json({
      ok: true, data: pending.map(t => {
        const subjects = [...new Set(t.teachersubject.map(ts => ts.subject.name))];
        const teachingClasses = [...new Set(t.teachersubject.map(ts => `${ts.Renamedclass.name}${ts.Renamedclass.section}`))];
        const headOfClassObj = t.Renamedclass_Renamedclass_classHeadIdToteacher;
        const headOfClass = headOfClassObj ? `${headOfClassObj.name}${headOfClassObj.section}` : null;

        return {
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`,
          email: t.user.email,
          subjects,
          classes: teachingClasses,
          isClassTeacher: t.isClassTeacher,
          headOfClass: headOfClass,
          createdAt: t.createdAt
        };
      })
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/teachers/:id/approve', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const teacher = await prisma.teacher.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!teacher || teacher.schoolId !== schoolId) return res.status(404).json({ error: 'Teacher not found' });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { status: 'ACTIVE' } });
    res.json({ ok: true, message: 'Approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/teachers/:id/reject', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const teacher = await prisma.teacher.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!teacher || teacher.schoolId !== schoolId) return res.status(404).json({ error: 'Teacher not found' });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { status: 'REJECTED' } });
    res.json({ ok: true, message: 'Rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/teachers/:id/status', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { status } = req.body;
    const validStatuses = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!teacher || teacher.schoolId !== schoolId) return res.status(404).json({ error: 'Teacher not found' });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { status } });
    res.json({ ok: true, message: `Teacher status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update teacher status' });
  }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const teacherId = parseInt(req.params.id);
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.schoolId !== schoolId) return res.status(404).json({ error: 'Teacher not found' });

    // 1. Delete study material chain (quizresponse → question → quizset → studentmaterialstatus → studymaterial)
    const materials = await prisma.studymaterial.findMany({ where: { teacherId }, select: { id: true } });
    const materialIds = materials.map(m => m.id);
    if (materialIds.length > 0) {
      const quizSets = await prisma.quizset.findMany({ where: { studyMaterialId: { in: materialIds } }, select: { id: true } });
      const quizSetIds = quizSets.map(q => q.id);
      if (quizSetIds.length > 0) {
        const questions = await prisma.question.findMany({ where: { quizSetId: { in: quizSetIds } }, select: { id: true } });
        const questionIds = questions.map(q => q.id);
        if (questionIds.length > 0) {
          await prisma.quizresponse.deleteMany({ where: { questionId: { in: questionIds } } });
          await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
        }
        await prisma.quizset.deleteMany({ where: { id: { in: quizSetIds } } });
      }
      await prisma.studentmaterialstatus.deleteMany({ where: { studyMaterialId: { in: materialIds } } });
      await prisma.studymaterial.deleteMany({ where: { teacherId } });
    }

    // 2. Nullify nullable refs + delete teacher in one transaction
    await prisma.$transaction([
      prisma.renamedclass.updateMany({ where: { classHeadId: teacherId }, data: { classHeadId: null } }),
      prisma.assignment.updateMany({ where: { teacherId }, data: { teacherId: null } }),
      prisma.attendance.updateMany({ where: { teacherId }, data: { teacherId: null } }),
      prisma.exammark.updateMany({ where: { enteredById: teacherId }, data: { enteredById: null } }),
      prisma.submission.updateMany({ where: { gradedById: teacherId }, data: { gradedById: null } }),
      prisma.feedbackrequest.updateMany({ where: { teacherId }, data: { teacherId: null } }),
      prisma.subjectexamsubmission.updateMany({ where: { teacherId }, data: { teacherId: null } }),
      prisma.classexamsubmission.updateMany({ where: { teacherId }, data: { teacherId: null } }),
      prisma.teacher.delete({ where: { id: teacherId } }),
    ]);

    // Also delete the user account if exists
    if (teacher.userId) {
      await prisma.user.delete({ where: { id: teacher.userId } }).catch(() => { });
    }

    res.json({ ok: true, message: 'Teacher permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete teacher' });
  }
});

router.patch('/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, isClassTeacher, classId } = req.body;

    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    await prisma.$transaction(async (tx) => {
      // Update User data
      await tx.user.update({
        where: { id: teacher.userId },
        data: {
          firstName,
          lastName,
          email
        }
      });

      // If assigning as Class Head, sync with Renamedclass
      if (isClassTeacher && classId) {
        // First, unset any other class where this teacher might be head (1-to-1 enforcement)
        await tx.renamedclass.updateMany({
          where: { classHeadId: parseInt(id), id: { not: parseInt(classId) } },
          data: { classHeadId: null }
        });

        // Set as head of the selected class
        await tx.renamedclass.update({
          where: { id: parseInt(classId) },
          data: { classHeadId: parseInt(id) }
        });
      } else if (!isClassTeacher) {
        // If unsetting Class Head status, remove from any classes they head
        await tx.renamedclass.updateMany({
          where: { classHeadId: parseInt(id) },
          data: { classHeadId: null }
        });
      }

      // Update Teacher flag
      await tx.teacher.update({
        where: { id: parseInt(id) },
        data: { isClassTeacher: !!isClassTeacher }
      });
    });

    res.json({ ok: true, message: 'Class head updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

router.patch('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, rollNo, email } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ error: "Student not found" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.userId },
        data: {
          firstName,
          lastName,
          email
        }
      }),
      prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          firstName,
          lastName,
          rollNo: parseInt(rollNo)
        }
      })
    ]);

    res.json({ ok: true, message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const student = await prisma.student.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await prisma.student.delete({ where: { id: student.id } });
    res.json({ ok: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= CLASS & SUBJECT MANAGEMENT ================= */


// Get Class Overview (Combined Mapping)
router.get('/classes/overview', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    // Fetch all classes for this school with student and parent relations
    const classes = await prisma.renamedclass.findMany({
      where: { schoolId },
      include: {
        teacher_Renamedclass_classHeadIdToteacher: { include: { user: true } },
        teachersubject: {
          include: {
            subject: true,
            teacher: { include: { user: true } }
          }
        },
        _count: {
          select: {
            student: true
          }
        }
      }
    });

    // Batch-fetch parent counts per class (single query, no N+1)
    const classIds2 = classes.map(c => c.id);
    const parentsWithStudents2 = await prisma.parent.findMany({
      where: { student: { some: { classId: { in: classIds2 }, schoolId } } },
      select: {
        id: true,
        student: { where: { classId: { in: classIds2 }, schoolId }, select: { classId: true } }
      }
    });
    const parentSetByClass = {};
    for (const p of parentsWithStudents2) {
      for (const s of p.student) {
        if (s.classId) {
          if (!parentSetByClass[s.classId]) parentSetByClass[s.classId] = new Set();
          parentSetByClass[s.classId].add(p.id);
        }
      }
    }

    // Flatten into the expected format
    const overview = [];
    classes.forEach(cls => {
      const classHead = cls.teacher_Renamedclass_classHeadIdToteacher;
      const studentCount = cls._count.student;
      const parentCount = parentSetByClass[cls.id] ? parentSetByClass[cls.id].size : 0;

      if (cls.teachersubject.length === 0) {
        // Class with no subjects yet
        overview.push({
          classId: cls.id,
          className: cls.name,
          section: cls.section,
          subjectName: 'N/A',
          teacherName: classHead ? `${classHead.user.firstName} ${classHead.user.lastName}` : 'Unassigned',
          teacherId: classHead ? classHead.id : null,
          isClassHead: !!classHead,
          status: 'INCOMPLETE',
          studentCount,
          parentCount
        });
      } else {
        cls.teachersubject.forEach(ts => {
          overview.push({
            classId: cls.id,
            className: cls.name,
            section: cls.section,
            subjectName: ts.subject.name,
            teacherName: ts.teacher ? `${ts.teacher.user.firstName} ${ts.teacher.user.lastName}` : 'Unassigned',
            teacherId: ts.teacherId,
            status: 'ACTIVE',
            studentCount,
            parentCount
          });
        });

        // Ensure class head is at least noted if not in any subject
        if (classHead) {
          const isAlreadyIn = cls.teachersubject.some(ts => ts.teacherId === classHead.id);
          if (!isAlreadyIn) {
            overview.push({
              classId: cls.id,
              className: cls.name,
              section: cls.section,
              subjectName: 'N/A',
              teacherName: `${classHead.user.firstName} ${classHead.user.lastName}`,
              teacherId: classHead.id,
              isClassHead: true,
              status: 'ACTIVE',
              studentCount,
              parentCount
            });
          }
        }
      }
    });

    res.json({ ok: true, data: overview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch academic data' });
  }
});

// Get All Subjects
router.get('/subjects', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const subjects = await prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
    res.json({ ok: true, data: subjects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create Class
router.post('/classes', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { name, section } = req.body;

    if (!name || !section) return res.status(400).json({ error: "Name and Section required" });

    const newClass = await prisma.renamedclass.create({
      data: { name, section, schoolId }
    });
    res.json({ ok: true, data: newClass });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: "Class already exists" });
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Create Subject
router.post('/subjects', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: "Name required" });

    const newSubject = await prisma.subject.create({
      data: { name, schoolId }
    });
    res.json({ ok: true, data: newSubject });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: "Subject already exists" });
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Assign Teacher to Subject and Class
router.post('/classes/assign-teacher', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { classId, subjectId, teacherId } = req.body;

    if (!classId || !subjectId || !teacherId) {
      return res.status(400).json({ error: "Class, Subject, and Teacher are required" });
    }

    // Verify class, teacher, and subject all belong to this school
    const [cls, teacher, subject] = await Promise.all([
      prisma.renamedclass.findFirst({ where: { id: parseInt(classId), schoolId } }),
      prisma.teacher.findFirst({ where: { id: parseInt(teacherId), schoolId } }),
      prisma.subject.findFirst({ where: { id: parseInt(subjectId), schoolId } })
    ]);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    if (teacher.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only active teachers can be assigned to classes' });
    }
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    // Upsert the teaching assignment
    const assignment = await prisma.teachersubject.upsert({
      where: {
        teacherId_subjectId_classId: {
          teacherId: parseInt(teacherId),
          subjectId: parseInt(subjectId),
          classId: parseInt(classId)
        }
      },
      update: { teacherId: parseInt(teacherId) },
      create: {
        teacherId: parseInt(teacherId),
        subjectId: parseInt(subjectId),
        classId: parseInt(classId)
      }
    });

    res.json({ ok: true, data: assignment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign teacher' });
  }
});

// Delete Class
router.delete('/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = await getAdminSchoolId(req.user.userId);

    // Verify ownership
    const cls = await prisma.renamedclass.findFirst({
      where: { id: parseInt(id), schoolId }
    });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    await prisma.renamedclass.delete({
      where: { id: parseInt(id) }
    });
    res.json({ ok: true, message: 'Class deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});


// Update Class Teacher
// Handle both POST and PATCH for head assignment
router.post('/classes/:id/assign-class-teacher', async (req, res) => {
  // Redirect to the patch handler logic or just define it here.
  // Since we're in the same file, let's just make it call the same logic.
  return handleAssignClassTeacher(req, res);
});

async function handleAssignClassTeacher(req, res) {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);

    const currentClass = await prisma.renamedclass.findFirst({
      where: { id: parseInt(id), schoolId }
    });
    if (!currentClass) return res.status(404).json({ error: 'Class not found' });

    const oldTeacherId = currentClass.classHeadId;
    const actions = [];

    actions.push(
      prisma.renamedclass.update({
        where: { id: parseInt(id), schoolId },
        data: { classHeadId: teacherId ? parseInt(teacherId) : null }
      })
    );

    if (oldTeacherId && oldTeacherId !== parseInt(teacherId)) {
      actions.push(
        prisma.teacher.update({
          where: { id: oldTeacherId },
          data: { isClassTeacher: false }
        })
      );
    }

    if (teacherId) {
      actions.push(
        prisma.teacher.update({
          where: { id: parseInt(teacherId) },
          data: { isClassTeacher: true }
        })
      );
    }

    await prisma.$transaction(actions);

    res.json({ ok: true, message: 'Class head updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign class head' });
  }
}

router.patch('/classes/:id/assign-class-teacher', handleAssignClassTeacher);

// Remove Teacher from Class (removes all subject mappings)
router.delete('/classes/:classId/teachers/:teacherId', async (req, res) => {
  try {
    const { classId, teacherId } = req.params;
    const schoolId = await getAdminSchoolId(req.user.userId);

    // 1. Remove from teachersubject
    await prisma.teachersubject.deleteMany({
      where: {
        classId: parseInt(classId),
        teacherId: parseInt(teacherId)
      }
    });

    // 2. If they were class teacher, remove that too
    const cls = await prisma.renamedclass.findFirst({
      where: { id: parseInt(classId), schoolId }
    });

    if (cls.classHeadId === parseInt(teacherId)) {
      await prisma.renamedclass.update({
        where: { id: parseInt(classId) },
        data: { classHeadId: null }
      });
    }

    res.json({ ok: true, message: 'Teacher removed from class' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ================= EXAM MARKS WORKFLOW ================= */
// Publish Exam Terminal Result
router.post('/publish-terminal', async (req, res) => {
  try {
    const { examTerminal, schoolDetails } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);
    const adminId = parseInt(req.user.userId);

    // 1. Update School Info (Address, Phone, etc.)
    if (schoolDetails) {
      await prisma.school.update({
        where: { id: schoolId },
        data: {
          address: schoolDetails.address,
          phone: schoolDetails.phone,
          email: schoolDetails.email || undefined, // Don't nullify if empty
          logoUrl: schoolDetails.logoUrl
        }
      });
    }

    // 2. Official Publish Record
    const publish = await prisma.schoolexampublish.upsert({
      where: {
        schoolId_examTerminal: {
          schoolId: schoolId,
          examTerminal: examTerminal
        }
      },
      update: {
        status: 'PUBLISHED',
        calculationStatus: 'NOT_STARTED', // Reset gate on each publish
        publishedAt: new Date(),
        adminId: adminId
      },
      create: {
        schoolId: schoolId,
        examTerminal: examTerminal,
        status: 'PUBLISHED',
        calculationStatus: 'NOT_STARTED',
        adminId: adminId
      }
    });

    // 3. Fetch Data for Grade Sheets
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { isApproved: true },
          { promotionStatus: 'PENDING' }
        ]
      },
      include: {
        Renamedclass: true,
        parent: { include: { user: true } },
        user: true
      }
    });

    let marks = await prisma.exammark.findMany({
      where: {
        student: { schoolId },
        examTerminal: examTerminal
      },
      include: { subject: true }
    });

    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    // 4. Process Each Student
    for (const student of students) {
      const studentMarks = marks.filter(m => m.studentId === student.id);
      if (studentMarks.length === 0) continue;

      let totalObtained = 0;
      let totalFull = 0;

      const subjectResults = studentMarks.map(m => {
        totalObtained += m.marks || 0;
        totalFull += m.fullMarks || 100;

        const gradeInfo = getGradeFromMarks(m.marks || 0, m.fullMarks || 100);
        const subjectEval = evaluateSubjectResult({
          theoryMarks: m.theoryMarks || 0,
          theoryFullMarks: m.theoryFullMarks || 0,
          theoryPassMarks: m.theoryPassMarks || 0,
          practicalMarks: m.practicalMarks || 0,
          practicalFullMarks: m.practicalFullMarks || 0,
          practicalPassMarks: m.practicalPassMarks || 0,
          marks: m.marks || 0,
          fullMarks: m.fullMarks || 100
        });

        return {
          subject: m.subject.name,
          theory: m.theoryMarks,
          practical: m.practicalMarks,
          total: m.marks,
          full: m.fullMarks,
          pass: m.passMarks,
          status: subjectEval.status,
          grade: gradeInfo.grade,
          gpa: gradeInfo.gpa,
          gradeColor: gradeInfo.color,
          passed: subjectEval.passed
        };
      });

      const overallResult = calculateOverallGPA(subjectResults);
      const percentage = totalFull > 0 ? ((totalObtained / totalFull) * 100).toFixed(2) : 0;
      const finalStatus = overallResult.passed ? 'PASS' : 'FAIL';

      // NOTE: Promotion logic has been moved to run-calculation endpoint (Fix 1).
      // Publish only makes results visible and sends grade sheets — no promotions here.

      // 5. System Notifications for Parents
      if (student.parent && student.parent.length > 0) {
        for (const parent of student.parent) {
          await prisma.notification.create({
            data: {
              schoolId,
              parentId: parent.id,
              studentId: student.id,
              message: `Official Results for ${student.firstName} (${examTerminal}) are now available! Result: ${finalStatus} | GPA: ${overallResult.gpa} (${overallResult.grade}) | ${percentage}%. View the full grade sheet in the Performance section.`,
              type: NT.RESULT_PUBLISHED
            }
          });

          // 7. Send Email
          if (parent.user?.email) {
            const emailHtml = `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 2px solid #052e16; padding: 25px; color: #333;">
                <div style="text-align: center; border-bottom: 3px double #052e16; padding-bottom: 15px; margin-bottom: 20px;">
                  <h1 style="margin: 0; color: #052e16; letter-spacing: 1px;">${school.name}</h1>
                  <p style="margin: 5px 0; font-size: 14px;">${school.address || "Academic Institution"}</p>
                  <p style="margin: 5px 0; font-size: 13px;">Tel: ${school.phone || "N/A"} | Email: ${school.email || "N/A"}</p>
                  <div style="margin-top: 15px; background: #052e16; color: white; padding: 8px; font-weight: bold; border-radius: 4px;">
                    ${examTerminal.toUpperCase()} - ${new Date().getFullYear()}
                  </div>
                  <h3 style="margin: 15px 0 5px 0; text-transform: uppercase; font-size: 18px;">Grade Sheet</h3>
                </div>

                <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
                  <tr>
                    <td><strong>Student:</strong> ${student.firstName} ${student.lastName}</td>
                    <td style="text-align: right;"><strong>Roll No:</strong> ${student.rollNo}</td>
                  </tr>
                  <tr>
                    <td><strong>Class:</strong> ${student.Renamedclass?.name || "N/A"}</td>
                    <td style="text-align: right;"><strong>Section:</strong> ${student.Renamedclass?.section || "A"}</td>
                  </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #052e16;">
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left;">Subject</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Theory</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Practical</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Total</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Grade</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">GPA</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${subjectResults.map(s => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #e2e8f0;">${s.subject}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${s.theory ?? '-'}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${s.practical ?? '-'}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${s.total}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: ${s.gradeColor}; font-weight: bold;">${s.grade}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${s.gpa}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: ${s.status === 'FAILED' ? '#ef4444' : '#10b981'}; font-weight: bold;">${s.status}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <div style="margin-top: 25px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
                  <table style="width: 100%;">
                    <tr>
                      <td><strong>Grand Total:</strong></td>
                      <td style="text-align: right;"><strong>${totalObtained} / ${totalFull}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>Percentage:</strong></td>
                      <td style="text-align: right;"><strong>${percentage}%</strong></td>
                    </tr>
                    <tr>
                      <td><strong>Overall GPA:</strong></td>
                      <td style="text-align: right; font-weight: bold; font-size: 16px;">${overallResult.gpa}</td>
                    </tr>
                    <tr>
                      <td><strong>Overall Grade:</strong></td>
                      <td style="text-align: right; font-weight: bold; font-size: 16px;">${overallResult.grade}${overallResult.description ? ' (' + overallResult.description + ')' : ''}</td>
                    </tr>
                    <tr>
                      <td><strong>Final Status:</strong></td>
                      <td style="text-align: right; color: ${finalStatus === 'FAIL' ? '#ef4444' : '#10b981'}; font-weight: bold; font-size: 16px;">${finalStatus}</td>
                    </tr>
                  </table>
                </div>

                <div style="margin-top: 25px;">
                  <h4 style="margin: 0 0 10px 0; color: #052e16; font-size: 13px;">Nepal NEB Grading Scale</h4>
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">Grade</th>
                        <th style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">GPA</th>
                        <th style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">Percentage</th>
                        <th style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: left;">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${getGradeTable().map(g => `
                        <tr>
                          <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: center; color: ${g.color}; font-weight: bold;">${g.grade}</td>
                          <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: center;">${g.gpa}</td>
                          <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: center;">${g.min}% - ${g.max}%</td>
                          <td style="padding: 4px 8px; border: 1px solid #e2e8f0;">${g.description}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; font-style: italic;">
                  This is a system generated grade sheet provided by School Space academic portal.
                </div>
              </div>
            `;

            try {
              await mailer.sendEmail({
                to: parent.user.email,
                subject: `Official Grade Sheet: ${student.firstName} - ${examTerminal}`,
                html: emailHtml
              });
            } catch (err) {
              console.error(`Email delivery failed for student ${student.id}:`, err.message);
            }
          }
        }
      }
    }

    // 8. Notify Teachers (Class Heads and Subject Teachers)
    const schoolClasses = await prisma.renamedclass.findMany({
      where: { schoolId },
      include: { teachersubject: true }
    });

    for (const cls of schoolClasses) {
      const teacherIds = new Set();
      if (cls.classHeadId) teacherIds.add(cls.classHeadId);
      cls.teachersubject.forEach(ts => teacherIds.add(ts.teacherId));

      if (teacherIds.size > 0) {
        await prisma.notification.createMany({
          data: Array.from(teacherIds).map(tId => ({
            schoolId,
            teacherId: tId,
            message: `Official results for ${cls.name}${cls.section} (${examTerminal}) have been published by the administration.`,
            type: NT.RESULT_PUBLISHED
          }))
        });
      }
    }

    // 9. Comprehensive school-wide notification
    await prisma.notification.create({
      data: {
        schoolId: schoolId,
        message: `Academic Alert: Official results for ${examTerminal} have been published institution-wide. All parents and teachers can now access individual grade sheets and summaries via their dashboards.`,
        type: NT.INFO
      }
    });

    res.json({ ok: true, data: publish });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish results' });
  }
});


/*
 * run-calculation behavior:
 * Terms 1-3: aggregate metrics only, no promotion, no session advance
 * Term 4:   aggregate + mark Class 1-9 PROMOTED/PENDING (does NOT advance session)
 *            Session advancement only happens when admin explicitly ends the session.
 * Class 10:  NEVER processed here — handled by advance-session or graduate-class10-early
 */
router.post('/run-calculation', async (req, res) => {
  try {
    const { examTerminal } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);
    const adminId = parseInt(req.user.userId);

    // Verify that submissions exist for this terminal
    const submissionCount = await prisma.classexamsubmission.count({
      where: { Renamedclass: { schoolId }, examTerminal }
    });

    if (submissionCount === 0) {
      return res.status(400).json({ error: "No exam submissions found for this terminal. Teachers must submit marks first." });
    }

    // Check if already calculated
    const existingRecord = await prisma.schoolexampublish.findUnique({
      where: { schoolId_examTerminal: { schoolId, examTerminal } }
    });
    if (existingRecord?.calculationStatus === 'COMPLETED') {
      return res.status(400).json({ error: "Calculation has already been completed for this terminal." });
    }

    // Enforce correct order: results must be published before calculation
    if (!existingRecord || existingRecord.status !== 'PUBLISHED') {
      return res.status(400).json({ error: "Results must be published before running calculation. Publish results first." });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, activePerformanceSession: true, activePerformanceYear: true }
    });

    const currentSession = school.activePerformanceSession || "1st Session";
    const currentYear = school.activePerformanceYear || 2026;

    // ── STEP 1: Snapshot timestamp — all data before this point belongs to this session ──
    const snapshotAt = new Date();

    await finalizeSessionAssignments(schoolId, currentSession, currentYear);

    // Mark calculation as COMPLETED with snapshot timestamp
    await prisma.schoolexampublish.upsert({
      where: { schoolId_examTerminal: { schoolId, examTerminal } },
      update: { calculationStatus: 'COMPLETED', calculationSnapshotAt: snapshotAt },
      create: { schoolId, examTerminal, status: 'NOT_PUBLISHED', calculationStatus: 'COMPLETED', calculationSnapshotAt: snapshotAt, adminId }
    });

    // ── STEP 2: Calculate Performance & Potential for every student ──
    const { calculatePerformance } = require('../../utils/performanceCalculator');
    const { calculatePotential } = require('../../utils/potentialCalculator');

    const allStudents = await prisma.student.findMany({
      where: { schoolId, isApproved: true },
      include: { Renamedclass: true }
    });

    let calculatedCount = 0;

    for (const student of allStudents) {
      if (!student.classId) continue;

      // --- Collect data up to snapshot ---

      // Exam marks for this terminal
      const examMarks = await prisma.exammark.findMany({
        where: { studentId: student.id, examTerminal }
      });

      // Assignments created before snapshot for student's class
      const assignments = await prisma.assignment.findMany({
        where: { classId: student.classId, createdAt: { lte: snapshotAt } }
      });
      const assignmentIds = assignments.map(a => a.id);

      // Graded submissions before snapshot
      const gradedSubmissions = assignmentIds.length > 0 ? await prisma.submission.findMany({
        where: { studentId: student.id, assignmentId: { in: assignmentIds }, grade: { not: null } }
      }) : [];

      // All submissions (for effort calculation)
      const allSubmissions = assignmentIds.length > 0 ? await prisma.submission.findMany({
        where: { studentId: student.id, assignmentId: { in: assignmentIds } }
      }) : [];

      // Attendance records before snapshot
      const attendanceRecords = await prisma.attendance.findMany({
        where: { studentId: student.id, date: { lte: snapshotAt } }
      });

      // Study materials created before snapshot for student's class
      const materials = await prisma.studymaterial.findMany({
        where: { classId: student.classId, createdAt: { lte: snapshotAt } }
      });
      const materialIds = materials.map(m => m.id);

      // Student material progress
      const progressRecords = materialIds.length > 0 ? await prisma.studentmaterialstatus.findMany({
        where: { studentId: student.id, studyMaterialId: { in: materialIds } }
      }) : [];

      // Quiz questions across all materials' quizsets
      const quizSets = materialIds.length > 0 ? await prisma.quizset.findMany({
        where: { studyMaterialId: { in: materialIds } },
        select: { id: true }
      }) : [];
      const quizSetIds = quizSets.map(q => q.id);

      const totalQuestions = quizSetIds.length > 0 ? await prisma.question.count({
        where: { quizSetId: { in: quizSetIds } }
      }) : 0;

      // Student's quiz responses
      const quizResponses = totalQuestions > 0 ? await prisma.quizresponse.findMany({
        where: { studentId: student.id, question: { quizSetId: { in: quizSetIds } }, createdAt: { lte: snapshotAt } }
      }) : [];

      const totalSolved = quizResponses.length;
      const correctAnswers = quizResponses.filter(r => r.isCorrect === true).length;
      const incorrectAnswers = quizResponses.filter(r => r.isCorrect === false).length;

      // Total school days (days with any attendance record for any student)
      const totalSchoolDays = attendanceRecords.length;

      // --- Calculate scores ---
      const perf = calculatePerformance(examMarks, gradedSubmissions, attendanceRecords, totalSchoolDays);
      const pot = calculatePotential(assignments, allSubmissions, materials, progressRecords, totalQuestions, totalSolved, correctAnswers, incorrectAnswers);

      // --- Store in potentialmetric ---
      await prisma.potentialmetric.upsert({
        where: { studentId_session_sessionYear: { studentId: student.id, session: currentSession, sessionYear: currentYear } },
        update: {
          terminal: examTerminal,
          snapshotAt,
          examScore: perf.examScore,
          assignmentScore: perf.assignmentScore,
          attendanceScore: perf.attendanceScore,
          performanceTotal: perf.performanceTotal,
          effortAssignment: pot.effortAssignment,
          effortMaterials: pot.effortMaterials,
          effortTotal: pot.effortTotal,
          curiosityQuiz: pot.curiosityQuiz,
          curiosityMcq: null, // teacher fills in later
          curiosityTotal: null,
          learningSpeed: pot.learningSpeed,
          potentialTotal: null, // set after teacher fills curiosityMcq
          status: 'PENDING_TEACHER_REVIEW'
        },
        create: {
          studentId: student.id,
          session: currentSession,
          sessionYear: currentYear,
          terminal: examTerminal,
          snapshotAt,
          examScore: perf.examScore,
          assignmentScore: perf.assignmentScore,
          attendanceScore: perf.attendanceScore,
          performanceTotal: perf.performanceTotal,
          effortAssignment: pot.effortAssignment,
          effortMaterials: pot.effortMaterials,
          effortTotal: pot.effortTotal,
          curiosityQuiz: pot.curiosityQuiz,
          curiosityMcq: null,
          curiosityTotal: null,
          learningSpeed: pot.learningSpeed,
          potentialTotal: null,
          status: 'PENDING_TEACHER_REVIEW'
        }
      });

      calculatedCount++;
    }

    // ── STEP 3: Notify class teachers to verify + fill curiosity MCQ ──
    const classTeachers = await prisma.teacher.findMany({
      where: { schoolId, isClassTeacher: true, status: 'ACTIVE' }
    });
    if (classTeachers.length > 0) {
      await prisma.notification.createMany({
        data: classTeachers.map(t => ({
          schoolId,
          teacherId: t.id,
          message: `Calculation complete for ${examTerminal}. Please verify student analytics and fill in Curiosity MCQ scores to finalize potential ratings.`,
          type: NT.SYSTEM_NOTICE
        }))
      });
    }

    // ── STEP 4: Promotion marking (4th Term only) — does NOT advance session ──
    // Session advancement only happens when admin explicitly ends the session via /end-session.
    const isFourthTerm = examTerminal.toLowerCase().includes('4th');
    let promotionResult = null;

    if (isFourthTerm) {
      const FINAL_CLASS_LEVEL = 10;
      const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });
      const promotableStudents = await prisma.student.findMany({
        where: { schoolId, isApproved: true, OR: [{ promotionStatus: 'NONE' }, { promotionStatus: null }] },
        include: { Renamedclass: true, parent: { include: { user: true } } }
      });

      const termMarks = await prisma.exammark.findMany({
        where: { student: { schoolId }, examTerminal }
      });
      const resultMap = {};
      for (const mark of termMarks) {
        if (!resultMap[mark.studentId]) resultMap[mark.studentId] = { isFail: false, hasMarks: true };
        if (['FAIL', 'FAILED'].includes(mark.status)) resultMap[mark.studentId].isFail = true;
      }

      let promoted = 0, pendingReview = 0, skipped = 0;

      for (const student of promotableStudents) {
        if (!student.Renamedclass) { skipped++; continue; }
        const level = parseInt(student.Renamedclass.name);
        if (isNaN(level)) { skipped++; continue; }
        if (level >= FINAL_CLASS_LEVEL) { skipped++; continue; } // Class 10: skip here (handled via graduate-class10-early or advance-session)

        const result = resultMap[student.id];
        if (!result || !result.hasMarks) { skipped++; continue; }

        if (!result.isFail) {
          // Mark as PROMOTED — actual class move happens when admin ends the session
          const prevLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
          await prisma.student.update({
            where: { id: student.id },
            data: { promotionStatus: 'PROMOTED', promotionAcknowledgedAt: null, previousClass: prevLabel }
          });
          promoted++;
        } else {
          // Mark as PENDING review — student stays in current class until admin resolves
          await prisma.student.update({
            where: { id: student.id },
            data: { promotionStatus: 'PENDING', isApproved: false, promotionAcknowledgedAt: null }
          });
          pendingReview++;
        }
      }
      promotionResult = { promoted, pendingReview, skipped };

      // Notify about promotion results — session stays active until admin ends it
      let notifMsg = `4th Term calculation complete. ${promoted} students marked for promotion, ${pendingReview} pending review. Please review the Class Promotion tab, then end the 4th session when ready.`;
      await prisma.notification.create({ data: { schoolId, message: notifMsg, type: NT.SYSTEM_NOTICE } });

      res.json({
        ok: true,
        message: notifMsg,
        promotion: promotionResult,
        calculated: calculatedCount,
        isFourthTerm: true
      });
    } else {
      // Terms 1-3: metrics only, no promotion changes
      await prisma.notification.create({
        data: { schoolId, adminId, message: `Calculation complete for ${examTerminal}. ${calculatedCount} students scored. Class teachers notified to verify.`, type: NT.SYSTEM_NOTICE }
      });
      res.json({
        ok: true,
        terminal: examTerminal,
        calculated: calculatedCount,
        isFourthTerm: false,
        message: `Metrics calculated for ${examTerminal}. Class teachers notified to fill curiosity scores.`
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to run calculations' });
  }
});

// Get Exam Submission Overview
router.get('/exam-submissions', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { examTerminal } = req.query;

    // 1. Fetch all published info for this school
    const publishedRecords = await prisma.schoolexampublish.findMany({
      where: { schoolId }
    });

    const publishedData = publishedRecords.map(p => ({
      terminalName: p.examTerminal,
      isPublished: p.status === 'PUBLISHED',
      calculationStatus: p.calculationStatus
    }));

    // 2. Fetch class submissions with details
    // We filter by terminal if provided
    const submissions = await prisma.classexamsubmission.findMany({
      where: {
        Renamedclass: { schoolId },
        ...(examTerminal ? { examTerminal } : {})
      },
      include: {
        Renamedclass: true,
        teacher: {
          include: { user: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // 3. For each submission, get the count of subject submissions
    const detailedSubmissions = await Promise.all(submissions.map(async (s) => {
      const subjectSubCount = await prisma.subjectexamsubmission.count({
        where: {
          classId: s.classId,
          examTerminal: s.examTerminal
        }
      });

      return {
        id: s.id,
        classId: s.classId,
        class: {
          name: s.Renamedclass.name,
          section: s.Renamedclass.section
        },
        examTerminal: s.examTerminal,
        submittedAt: s.submittedAt,
        submittedBy: s.teacher ? {
          user: {
            firstName: s.teacher.user.firstName,
            lastName: s.teacher.user.lastName
          }
        } : { user: { firstName: 'System', lastName: '' } },
        subjectSubmissions: Array(subjectSubCount).fill({}) // Frontend uses .length
      };
    }));

    const classes = await prisma.renamedclass.findMany({
      where: { schoolId }
    });

    res.json({
      ok: true,
      data: {
        submissions: detailedSubmissions,
        published: publishedData,
        totalClasses: classes.length,
        submittedClasses: detailedSubmissions.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET Results History — all published terminals with stats
router.get('/results-history', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    const published = await prisma.schoolexampublish.findMany({
      where: { schoolId },
      orderBy: { publishedAt: 'desc' }
    });

    const history = await Promise.all(published.map(async (p) => {
      const prefix = p.examTerminal.split(' ')[0];
      // Aggregate exam marks for this terminal
      const marks = await prisma.exammark.findMany({
        where: { student: { schoolId }, examTerminal: { startsWith: prefix } },
        select: { marks: true, fullMarks: true, status: true, studentId: true }
      });
      const uniqueStudents = new Set(marks.map(m => m.studentId)).size;
      const totalFull = marks.reduce((s, m) => s + (m.fullMarks || 0), 0);
      const totalObtained = marks.reduce((s, m) => s + (m.marks || 0), 0);
      const passedStudents = marks.filter(m => m.status === 'PASSED').length;
      const failedStudents = marks.filter(m => m.status === 'FAILED').length;

      // Class submission count
      const classSubs = await prisma.classexamsubmission.count({
        where: { Renamedclass: { schoolId }, examTerminal: { startsWith: prefix } }
      });

      return {
        terminal: p.examTerminal,
        status: p.status,
        calculationStatus: p.calculationStatus,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        classCount: classSubs,
        studentCount: uniqueStudents,
        totalObtained,
        totalFull,
        percentage: totalFull > 0 ? ((totalObtained / totalFull) * 100).toFixed(1) : null,
        passCount: passedStudents,
        failCount: failedStudents
      };
    }));

    // Current school session info
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true, activePerformanceYear: true }
    });

    res.json({ ok: true, data: history, currentSession: school?.activePerformanceSession, currentYear: school?.activePerformanceYear });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results history' });
  }
});

// ================= SESSION MANAGEMENT =================

// POST /start-session — Start a new academic session
router.post('/start-session', async (req, res) => {
  try {
    const { session, year, confirmation } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);

    if (!session || !year) {
      return res.status(400).json({ error: 'Session and year are required' });
    }

    const validSessions = ['1st Session', '2nd Session', '3rd Session', '4th Session'];
    if (!validSessions.includes(session)) {
      return res.status(400).json({ error: 'Invalid session. Must be 1st–4th Session.' });
    }

    const parsedYear = parseInt(year);
    const currentCalendarYear = new Date().getFullYear();
    if (isNaN(parsedYear) || parsedYear < currentCalendarYear || parsedYear > currentCalendarYear + 1) {
      return res.status(400).json({ error: `Year must be ${currentCalendarYear} or ${currentCalendarYear + 1}.` });
    }

    if (!confirmation || confirmation.trim().toUpperCase() !== 'START SESSION') {
      return res.status(400).json({ error: 'Type "START SESSION" to confirm.' });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, activePerformanceSession: true, activePerformanceYear: true }
    });

    // Block if session already active (must end current session first)
    if (school.activePerformanceSession) {
      return res.status(400).json({ error: 'A session is already active. End it before starting a new one.' });
    }

    // Check for duplicate session+year already completed
    const existingCompletion = await prisma.sessioncompletion.findFirst({
      where: { schoolId, session, year: parsedYear }
    });
    if (existingCompletion) {
      return res.status(400).json({ error: `${session} (${parsedYear}) has already been completed. Choose a different session or year.` });
    }

    // Enforce sequential order: 1st → 2nd → 3rd → 4th
    const sessionOrder = { '1st Session': 1, '2nd Session': 2, '3rd Session': 3, '4th Session': 4 };
    const requestedNum = sessionOrder[session];

    if (requestedNum === 1) {
      // 1st Session: allowed if no sessions completed for this year yet (fresh year)
      // OR if 4th Session of previous year was completed
      const anyCompletedThisYear = await prisma.sessioncompletion.findFirst({
        where: { schoolId, year: parsedYear }
      });
      if (!anyCompletedThisYear) {
        // Fresh year — check if previous year's 4th was completed (skip for very first session ever)
        const anySessionEver = await prisma.sessioncompletion.count({ where: { schoolId } });
        if (anySessionEver > 0) {
          const prev4th = await prisma.sessioncompletion.findFirst({
            where: { schoolId, session: '4th Session', year: parsedYear - 1 }
          });
          if (!prev4th) {
            return res.status(400).json({ error: `Complete 4th Session (${parsedYear - 1}) before starting 1st Session (${parsedYear}).` });
          }
        }
        // else: very first session ever for this school — allow
      }
    } else {
      // 2nd/3rd/4th: previous session in same year must be completed
      const prevSessionName = Object.keys(sessionOrder).find(k => sessionOrder[k] === requestedNum - 1);
      const prevCompleted = await prisma.sessioncompletion.findFirst({
        where: { schoolId, session: prevSessionName, year: parsedYear }
      });
      if (!prevCompleted) {
        return res.status(400).json({ error: `Complete ${prevSessionName} (${parsedYear}) before starting ${session}.` });
      }
    }

    const previousSession = school.activePerformanceSession;
    const previousYear = school.activePerformanceYear;

    // Reset all student promotion statuses for the new session cycle
    if (session === '1st Session') {
      await prisma.student.updateMany({
        where: { schoolId, promotionStatus: { notIn: ['GRADUATED'] } },
        data: { promotionStatus: 'NONE' }
      });

      // Clear exam marks, submissions, publishes, rating history, potential metrics, and session completions for the new year
      await prisma.exammark.deleteMany({
        where: { student: { schoolId } }
      });
      await prisma.classexamsubmission.deleteMany({
        where: { Renamedclass: { schoolId } }
      });
      await prisma.subjectexamsubmission.deleteMany({
        where: { Renamedclass: { schoolId } }
      });
      await prisma.schoolexampublish.deleteMany({
        where: { schoolId }
      });
      await prisma.sessioncompletion.deleteMany({
        where: { schoolId }
      });
      await prisma.rating.deleteMany({
        where: { teacher: { schoolId } }
      });
      await prisma.potentialmetric.deleteMany({
        where: { student: { schoolId } }
      });
    }

    // Update school session
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        activePerformanceSession: session,
        activePerformanceYear: parseInt(year)
      }
    });

    // Send SESSION_STARTED notification to all school users
    const notifMessage = `${session} (${year}) has started. Academic activities are now active.`;

    // Gather all recipient IDs
    const [allTeachers, allStudents, allParents] = await Promise.all([
      prisma.teacher.findMany({ where: { schoolId, status: 'ACTIVE' }, select: { id: true } }),
      prisma.student.findMany({ where: { schoolId, isApproved: true }, select: { id: true } }),
      prisma.parent.findMany({ where: { schoolId }, select: { id: true } })
    ]);

    const notifications = [];
    // Admin notification
    notifications.push({ schoolId, adminId: parseInt(req.user.userId), message: notifMessage, type: NT.SESSION_STARTED });
    // Teacher notifications
    for (const t of allTeachers) {
      notifications.push({ schoolId, teacherId: t.id, message: notifMessage, type: NT.SESSION_STARTED });
    }
    // Student notifications
    for (const s of allStudents) {
      notifications.push({ schoolId, studentId: s.id, message: notifMessage, type: NT.SESSION_STARTED });
    }
    // Parent notifications
    for (const p of allParents) {
      notifications.push({ schoolId, parentId: p.id, message: notifMessage, type: NT.SESSION_STARTED });
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }

    res.json({
      ok: true,
      message: `${session} (${year}) is now active`,
      session,
      year: parseInt(year),
      previous: previousSession ? { session: previousSession, year: previousYear } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /end-session — End current session with confirmation (locks session, optionally advances)
router.post('/end-session', async (req, res) => {
  try {
    const { confirmation } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, activePerformanceSession: true, activePerformanceYear: true }
    });

    if (!school.activePerformanceSession) {
      return res.status(400).json({ error: 'No active session to end.' });
    }

    if (!confirmation || confirmation.trim().toUpperCase() !== school.name.trim().toUpperCase()) {
      return res.status(400).json({ error: `Type your school name "${school.name}" to confirm.` });
    }

    // Mark session completion for all classes
    const classes = await prisma.renamedclass.findMany({ where: { schoolId } });
    const teachers = await prisma.teacher.findMany({ where: { schoolId, status: 'ACTIVE' } });

    for (const cls of classes) {
      for (const teacher of teachers) {
        await prisma.sessioncompletion.upsert({
          where: {
            classId_session_year: {
              classId: cls.id,
              session: school.activePerformanceSession,
              year: school.activePerformanceYear
            }
          },
          update: { completedAt: new Date() },
          create: {
            classId: cls.id,
            teacherId: teacher.id,
            schoolId,
            session: school.activePerformanceSession,
            year: school.activePerformanceYear,
            completedAt: new Date()
          }
        });
      }
    }

    const endedSession = school.activePerformanceSession;
    const endedYear = school.activePerformanceYear;
    const isFourthSessionEnd = endedSession?.toLowerCase().includes('4th');
    const newYear = (endedYear || new Date().getFullYear()) + 1;

    // ── If ending the 4th session: physically move PROMOTED students + graduate Class 10 ──
    if (isFourthSessionEnd) {
      const FINAL_CLASS_LEVEL = 10;
      const promoYear = newYear;
      const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });

      // ── Bulk Cleanup for all active students (Fresh start for next year) ──
      // 1. Delete all session-specific student data scoped to this school
      await prisma.submission.deleteMany({ where: { student: { schoolId } } });
      await prisma.studentmaterialstatus.deleteMany({ where: { student: { schoolId } } });
      await prisma.quizresponse.deleteMany({ where: { student: { schoolId } } });
      await prisma.attendance.deleteMany({ where: { student: { schoolId } } });
      await prisma.exammark.deleteMany({ where: { student: { schoolId } } });
      await prisma.potentialmetric.deleteMany({ where: { student: { schoolId } } });

      // 2. Delete class-level data (Cascades will handle child records)
      await prisma.assignment.deleteMany({ where: { Renamedclass: { schoolId } } });
      await prisma.studymaterial.deleteMany({ where: { Renamedclass: { schoolId } } });

      // 3. Clear session tracking/publishing records
      await prisma.schoolexampublish.deleteMany({ where: { schoolId } });
      await prisma.classexamsubmission.deleteMany({ where: { Renamedclass: { schoolId } } });
      await prisma.sessioncompletion.deleteMany({ where: { schoolId } });

      const processedIds = [];
      const parentNotifications = [];

      // 1. Handle PROMOTED Class 1-9 students (move to next class)
      const promotedStudents = await prisma.student.findMany({
        where: { schoolId, promotionStatus: 'PROMOTED' },
        include: { Renamedclass: true, parent: { select: { id: true } } }
      });

      for (const student of promotedStudents) {
        if (!student.Renamedclass) continue;
        const level = parseInt(student.Renamedclass.name);
        if (isNaN(level) || level >= FINAL_CLASS_LEVEL) continue;

        const nextClass = allClasses.find(c => c.name === (level + 1).toString() && c.section === student.Renamedclass.section);
        if (!nextClass) continue; // Skip if no next class found (rare)

        const rollClash = await prisma.student.findFirst({
          where: { classId: nextClass.id, rollNo: student.rollNo, id: { not: student.id } },
          select: { id: true }
        });
        let nextRoll = student.rollNo;
        if (rollClash) {
          const maxR = await prisma.student.aggregate({ where: { classId: nextClass.id }, _max: { rollNo: true } });
          nextRoll = (maxR._max.rollNo || 0) + 1;
        }

        await prisma.$transaction([
          prisma.student.update({
            where: { id: student.id },
            data: { classId: nextClass.id, rollNo: nextRoll, promotionStatus: 'NONE', promotionAcknowledgedAt: null }
          }),
          prisma.enrollment.upsert({
            where: { studentId_classId_year: { studentId: student.id, classId: nextClass.id, year: promoYear } },
            update: {},
            create: { studentId: student.id, classId: nextClass.id, year: promoYear }
          })
        ]);

        processedIds.push(student.id);

        if (student.parent?.length > 0) {
          student.parent.forEach(p => {
            parentNotifications.push({
              schoolId, parentId: p.id, studentId: student.id,
              message: `🎉 ${student.firstName} ${student.lastName} has been promoted to Class ${nextClass.name}${nextClass.section} for academic year ${promoYear}.`,
              type: NT.PROMOTION
            });
          });
        }
      }

      // 2. Handle RETAINED / Other Class 1-9 students (stay in current class)
      const otherStudents = await prisma.student.findMany({
        where: {
          schoolId,
          isApproved: true,
          id: { notIn: processedIds.length > 0 ? processedIds : [-1] },
          promotionStatus: { notIn: ['GRADUATED', 'ALUMNI'] },
          Renamedclass: { name: { not: FINAL_CLASS_LEVEL.toString() } }
        },
        include: { Renamedclass: true, parent: { select: { id: true } } }
      });

      for (const student of otherStudents) {
        if (!student.classId) continue;

        await prisma.$transaction([
          prisma.student.update({
            where: { id: student.id },
            data: { promotionStatus: 'NONE', promotionAcknowledgedAt: null, isApproved: true }
          }),
          prisma.enrollment.upsert({
            where: { studentId_classId_year: { studentId: student.id, classId: student.classId, year: promoYear } },
            update: {},
            create: { studentId: student.id, classId: student.classId, year: promoYear }
          })
        ]);

        if (student.promotionStatus === 'RETAINED' && student.parent?.length > 0) {
          student.parent.forEach(p => {
            parentNotifications.push({
              schoolId, parentId: p.id, studentId: student.id,
              message: `ℹ️ ${student.firstName} ${student.lastName} will continue in Class ${student.Renamedclass?.name}${student.Renamedclass?.section} for academic year ${promoYear}.`,
              type: NT.PROMOTION
            });
          });
        }
      }

      // 3. Batch Create Notifications
      if (parentNotifications.length > 0) {
        await prisma.notification.createMany({ data: parentNotifications });
      }

      // 4. Auto-graduate remaining Class 10 students
      const class10Students = await prisma.student.findMany({
        where: { schoolId, Renamedclass: { name: FINAL_CLASS_LEVEL.toString() }, promotionStatus: { notIn: ['GRADUATED'] } },
        include: { Renamedclass: true, parent: { select: { id: true } } }
      });
      const gradNotifications = [];
      for (const student of class10Students) {
        const gradLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
        await prisma.student.update({
          where: { id: student.id },
          data: { promotionStatus: 'GRADUATED', isApproved: true, graduatedAt: new Date(), graduationYear: endedYear, previousClass: gradLabel }
        });
        if (student.parent?.length > 0) {
          student.parent.forEach(p => {
            gradNotifications.push({
              schoolId, parentId: p.id, studentId: student.id,
              message: `🎓 Congratulations! ${student.firstName} ${student.lastName} has graduated from ${school.name} (Class 10). Academic year ${endedYear} complete.`,
              type: NT.GRADUATION
            });
          });
        }
      }
      if (gradNotifications.length > 0) {
        await prisma.notification.createMany({ data: gradNotifications });
      }
    }

    // Build the appropriate notification message
    let endNotifMessage;
    if (isFourthSessionEnd) {
      endNotifMessage = `🎓 4th Session (${endedYear}) has been officially ended. The ${endedYear} academic year is now complete. To begin the new academic year, go to Session Management → Start New Session → select "1st Session" for year ${newYear}. All teacher and admin dashboards will be reset when the new session starts.`;
    } else {
      endNotifMessage = `Academic session ended: ${endedSession} (${endedYear}). Use "Start Session" to begin the next session.`;
    }

    // Log session end
    await prisma.notification.create({
      data: {
        schoolId,
        adminId: parseInt(req.user.userId),
        message: endNotifMessage,
        type: NT.SESSION_ADVANCE
      }
    });

    // Clear active session (admin must explicitly start the next one)
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        activePerformanceSession: null,
        activePerformanceYear: null,
        ratingsEnabled: false,
        activeRatingSession: null,
        activeRatingYear: null
      }
    });

    res.json({
      ok: true,
      message: `${endedSession} (${endedYear}) has been ended.${isFourthSessionEnd ? ` The ${endedYear} academic year is complete. You may now start 1st Session (${newYear}) to begin the new academic year.` : ''}`,
      endedSession,
      endedYear,
      isFourthSessionEnd,
      newYearReady: isFourthSessionEnd,
      suggestedNextSession: isFourthSessionEnd ? '1st Session' : null,
      suggestedNextYear: isFourthSessionEnd ? newYear : null
    });
  } catch (err) {
    console.error('CRITICAL: End Session Error:', err);
    res.status(500).json({ error: 'Failed to end session: ' + err.message });
  }
});

// GET /session-history — List all completed sessions
router.get('/session-history', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    // Get unique session/year combos from sessioncompletion
    const completions = await prisma.sessioncompletion.findMany({
      where: { schoolId },
      select: { session: true, year: true, completedAt: true },
      orderBy: [{ year: 'desc' }, { completedAt: 'desc' }],
      distinct: ['session', 'year']
    });

    // Get published terminals for context
    const published = await prisma.schoolexampublish.findMany({
      where: { schoolId },
      select: { examTerminal: true, status: true, calculationStatus: true, publishedAt: true }
    });

    // Get current session info
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true, activePerformanceYear: true }
    });

    // Count stats per session
    const history = await Promise.all(completions.map(async (c) => {
      const classCount = await prisma.sessioncompletion.count({
        where: { schoolId, session: c.session, year: c.year }
      });

      // Map session to terminal
      const terminalPrefix = c.session.replace('Session', 'Term');
      const terminalPub = published.find(p => p.examTerminal === terminalPrefix);

      const examPublished = terminalPub?.status === 'PUBLISHED';
      const calculationDone = terminalPub?.calculationStatus === 'COMPLETED';
      const status = examPublished && calculationDone ? 'Published' : examPublished ? 'Published' : calculationDone ? 'Calculated' : 'Completed';

      return {
        session: c.session,
        year: c.year,
        completedAt: c.completedAt,
        classesCompleted: classCount,
        examPublished,
        calculationDone,
        status
      };
    }));

    res.json({
      ok: true,
      data: history,
      current: {
        session: school?.activePerformanceSession,
        year: school?.activePerformanceYear
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// POST /graduate-class10-early — Graduate Class 10 students before session ends
router.post('/graduate-class10-early', async (req, res) => {
  try {
    const { confirmation, year } = req.body;
    const schoolId = await getAdminSchoolId(req.user.userId);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, activePerformanceSession: true, activePerformanceYear: true }
    });

    // Validation: must be 4th session
    if (!school.activePerformanceSession || !school.activePerformanceSession.toLowerCase().includes('4th')) {
      return res.status(400).json({ error: 'No active 4th session found. Early graduation is only available during the 4th session.' });
    }

    if (year && parseInt(year) !== school.activePerformanceYear) {
      return res.status(400).json({ error: 'Year does not match the current active session year.' });
    }

    if (!confirmation || confirmation.trim().toUpperCase() !== 'GRADUATE CLASS 10') {
      return res.status(400).json({ error: 'Type "GRADUATE CLASS 10" to confirm.' });
    }

    const FINAL_CLASS_LEVEL = 10;

    // Find all Class 10 students NOT yet graduated
    const class10Students = await prisma.student.findMany({
      where: {
        schoolId,
        promotionStatus: { notIn: ['GRADUATED'] },
        Renamedclass: { name: { in: [FINAL_CLASS_LEVEL.toString()] } }
      },
      include: { parent: true, Renamedclass: true }
    });

    if (class10Students.length === 0) {
      return res.status(400).json({ error: 'All Class 10 students are already graduated.' });
    }

    let graduated = 0;
    let skipped = 0;

    const graduationYearValue = school.activePerformanceYear || new Date().getFullYear();
    for (const student of class10Students) {
      const gradLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
      await prisma.student.update({
        where: { id: student.id },
        data: {
          promotionStatus: 'GRADUATED',
          isApproved: true,
          graduatedAt: new Date(),
          graduationYear: graduationYearValue,
          promotionAcknowledgedAt: null,
          previousClass: gradLabel
        }
      });
      graduated++;

      // GRADUATION notification to parents
      if (student.parent && student.parent.length > 0) {
        await prisma.notification.createMany({
          data: student.parent.map(p => ({
            schoolId,
            parentId: p.id,
            studentId: student.id,
            message: `Congratulations! ${student.firstName} ${student.lastName} has successfully graduated from Class 10.`,
            type: NT.GRADUATION
          }))
        });
      }
    }

    // School-wide notification
    await prisma.notification.create({
      data: {
        schoolId,
        message: `Class 10 early graduation complete: ${graduated} students have been graduated for the ${school.activePerformanceYear} academic year.`,
        type: 'SYSTEM_NOTICE'
      }
    });

    res.json({
      ok: true,
      graduated,
      skipped,
      message: `${graduated} Class 10 students have been graduated`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process early graduation' });
  }
});

// GET /session-checklist — Pre-end checklist for current session
router.get('/session-checklist', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    if (!school?.activePerformanceSession) {
      return res.json({ ok: false, error: 'No active session' });
    }

    const session = school.activePerformanceSession;
    const year = school.activePerformanceYear;
    const terminal = session.replace('Session', 'Term');

    // 1. Exam marks — all classes should have classexamsubmission for this terminal
    const classes = await prisma.renamedclass.findMany({ where: { schoolId }, select: { id: true, name: true, section: true } });
    const classSubmissions = await prisma.classexamsubmission.findMany({
      where: { classId: { in: classes.map(c => c.id) }, examTerminal: terminal },
      select: { classId: true }
    });
    const submittedIds = new Set(classSubmissions.map(s => s.classId));
    const missingClasses = classes.filter(c => !submittedIds.has(c.id));

    // 2. Results published — schoolexampublish status
    const publishRecord = await prisma.schoolexampublish.findFirst({
      where: { schoolId, examTerminal: terminal }
    });
    const resultsPublished = publishRecord?.status === 'PUBLISHED';

    // 3. Scores calculated — schoolexampublish calculationStatus
    const calculationDone = publishRecord?.calculationStatus === 'COMPLETED';

    // 4. Teacher review — only required for sessions 1–3, not the 4th (final) session
    const is4thSession = session.toLowerCase().includes('4th');
    let pendingCount = 0, completedCount = 0, reviewDone = true;
    if (!is4thSession) {
      const studentIds = await prisma.student.findMany({ where: { schoolId, isApproved: true }, select: { id: true } });
      const metrics = await prisma.potentialmetric.findMany({
        where: { studentId: { in: studentIds.map(s => s.id) }, session, sessionYear: year },
        select: { status: true }
      });
      pendingCount = metrics.filter(m => m.status === 'PENDING_TEACHER_REVIEW').length;
      completedCount = metrics.filter(m => m.status === 'COMPLETED').length;
      reviewDone = metrics.length > 0 && pendingCount === 0;
    }

    const allPassed = missingClasses.length === 0 && resultsPublished && calculationDone && reviewDone;

    res.json({
      ok: true,
      session, year, terminal,
      is4thSession,
      checklist: {
        marks: {
          done: missingClasses.length === 0,
          submitted: submittedIds.size,
          total: classes.length,
          missing: missingClasses.map(c => `${c.name}${c.section || ''}`)
        },
        published: { done: resultsPublished },
        calculated: { done: calculationDone },
        reviewed: {
          done: reviewDone,
          completed: completedCount,
          pending: pendingCount,
          total: completedCount + pendingCount,
          skipped: is4thSession
        }
      },
      allPassed
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to load checklist' });
  }
});

// GET /class10-status — Get Class 10 graduation status (for frontend card)
router.get('/class10-status', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true, activePerformanceYear: true }
    });

    const isFourthSession = school?.activePerformanceSession?.toLowerCase().includes('4th');

    const total = await prisma.student.count({
      where: { schoolId, Renamedclass: { name: '10' } }
    });

    const graduated = await prisma.student.count({
      where: { schoolId, Renamedclass: { name: '10' }, promotionStatus: 'GRADUATED' }
    });

    res.json({
      ok: true,
      isFourthSession: !!isFourthSession,
      total,
      graduated,
      remaining: total - graduated,
      allGraduated: graduated >= total && total > 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Class 10 status' });
  }
});

// POST Advance Session manually (end current session without running full calculation)
// Preflight: what will happen when session advances
router.get('/advance-session/preview', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true, activePerformanceYear: true, ratingsEnabled: true }
    });
    // Support query params to override (for previewing specific session/year)
    let currentSession = req.query.session ? `${req.query.session} Session`.replace(/(\d+)\s*Session\s*Session/, '$1 Session') : school?.activePerformanceSession;
    let currentYear = req.query.year ? parseInt(req.query.year) : school?.activePerformanceYear;

    if (!currentSession) {
      const lastCompletion = await prisma.sessioncompletion.findFirst({
        where: { schoolId },
        orderBy: { completedAt: 'desc' }
      });
      if (lastCompletion) {
        currentSession = lastCompletion.session;
        currentYear = lastCompletion.year;
      } else {
        currentSession = '1st Session';
        currentYear = new Date().getFullYear();
      }
    }
    const { nextSession, nextYear } = getNextSession(currentSession, currentYear);
    const isFourthSession = currentSession.toLowerCase().includes('4th');
    const FINAL_CLASS_LEVEL = 10;

    // Count published terminals for this session
    const publishedCount = await prisma.schoolexampublish.count({
      where: { schoolId, status: 'PUBLISHED' }
    });

    // For 4th session: check Class 1-9 submission completeness (Class 10 exempt)
    let submissionCheck = null;
    if (isFourthSession) {
      const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });
      const classes1to9 = allClasses.filter(c => { const lvl = parseInt(c.name); return !isNaN(lvl) && lvl < FINAL_CLASS_LEVEL; });
      const class10List = allClasses.filter(c => { const lvl = parseInt(c.name); return !isNaN(lvl) && lvl >= FINAL_CLASS_LEVEL; });

      const submittedClasses = await prisma.classexamsubmission.findMany({
        where: { Renamedclass: { schoolId }, examTerminal: { contains: '4th' } },
        select: { classId: true }
      });
      const submittedClassIds = new Set(submittedClasses.map(s => s.classId));

      const classes1to9Missing = classes1to9.filter(c => !submittedClassIds.has(c.id));
      submissionCheck = {
        totalClasses1to9: classes1to9.length,
        submittedClasses1to9: classes1to9.length - classes1to9Missing.length,
        missingClasses: classes1to9Missing.map(c => `${c.name}${c.section}`),
        allSubmitted: classes1to9Missing.length === 0,
        class10Count: class10List.length
      };
    }

    let promotionPreview = null;
    if (isFourthSession) {
      // Class 10 students: ALL auto-graduate (no exam required)
      const class10Students = await prisma.student.count({
        where: {
          schoolId,
          isApproved: true,
          OR: [{ promotionStatus: 'NONE' }, { promotionStatus: null }],
          Renamedclass: { name: { in: ['10'] } }
        }
      });

      // Class 1-9 students: normal promotion logic based on exam results
      const students1to9 = await prisma.student.findMany({
        where: {
          schoolId,
          isApproved: true,
          OR: [{ promotionStatus: 'NONE' }, { promotionStatus: null }],
          Renamedclass: { name: { notIn: ['10'] } }
        },
        include: { Renamedclass: true }
      });

      const examMarks = await prisma.exammark.findMany({
        where: {
          student: { schoolId, Renamedclass: { name: { notIn: ['10'] } } },
          examTerminal: { contains: '4th' }
        }
      });
      const studentResults = {};
      for (const m of examMarks) {
        if (!studentResults[m.studentId]) studentResults[m.studentId] = { isFail: false };
        if (['FAIL', 'FAILED'].includes(m.status)) studentResults[m.studentId].isFail = true;
      }

      const withResults = Object.keys(studentResults).length;
      const passing = Object.values(studentResults).filter(r => !r.isFail).length;
      const failing = withResults - passing;

      promotionPreview = {
        totalStudents: students1to9.length + class10Students,
        class10AutoGraduate: class10Students,
        class1to9Total: students1to9.length,
        withResults,
        passing,
        failing,
        noResults: students1to9.length - withResults
      };
    }

    const blocked = isFourthSession && submissionCheck && !submissionCheck.allSubmitted;
    const blockReason = blocked ? `Missing submissions: ${submissionCheck.missingClasses.join(', ')}` : null;

    res.json({
      ok: true,
      currentSession, currentYear,
      nextSession, nextYear,
      isFourthSession,
      publishedCount,
      ratingsWillBeDisabled: school.ratingsEnabled,
      promotionPreview,
      submissionCheck,
      blocked: !!blocked,
      blockReason,
      class10: promotionPreview ? {
        count: promotionPreview.class10AutoGraduate,
        autoGraduate: isFourthSession,
        examRequired: false
      } : null,
      class1to9: promotionPreview ? {
        toPromote: promotionPreview.passing,
        toFail: promotionPreview.failing,
        noResults: promotionPreview.noResults,
        missingSubmissions: submissionCheck?.missingClasses || []
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

router.post('/advance-session', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        activePerformanceSession: true,
        activePerformanceYear: true,
        ratingsEnabled: true,
        activeRatingSession: true,
        activeRatingYear: true
      }
    });
    let currentSession = school?.activePerformanceSession;
    let currentYear = school?.activePerformanceYear;

    if (!currentSession) {
      const lastCompletion = await prisma.sessioncompletion.findFirst({
        where: { schoolId },
        orderBy: { completedAt: 'desc' }
      });
      if (lastCompletion) {
        currentSession = lastCompletion.session;
        currentYear = lastCompletion.year;
      } else {
        currentSession = '1st Session';
        currentYear = new Date().getFullYear();
      }
    }

    const { nextSession, nextYear } = getNextSession(currentSession, currentYear);
    const isFourthSession = currentSession.toLowerCase().includes('4th');
    const FINAL_CLASS_LEVEL = 10;

    // ── VALIDATION: For 4th session, block until Class 1-9 submissions are complete ──
    if (isFourthSession) {
      const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });
      const classes1to9 = allClasses.filter(c => { const lvl = parseInt(c.name); return !isNaN(lvl) && lvl < FINAL_CLASS_LEVEL; });

      const submittedClasses = await prisma.classexamsubmission.findMany({
        where: { Renamedclass: { schoolId }, examTerminal: { contains: '4th' } },
        select: { classId: true }
      });
      const submittedClassIds = new Set(submittedClasses.map(s => s.classId));
      const missingClasses = classes1to9.filter(c => !submittedClassIds.has(c.id));

      if (missingClasses.length > 0) {
        return res.status(400).json({
          error: `Cannot advance session. Teacher submissions missing for Classes 1-9: ${missingClasses.map(c => `${c.name}${c.section}`).join(', ')}. Class 10 is exempt.`
        });
      }
    }

    // ── PHASE 1: Promotion (only on 4th Session → new year) ──
    let promotionResult = null;
    if (isFourthSession) {
      const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });
      const students = await prisma.student.findMany({
        where: { schoolId, isApproved: true, OR: [{ promotionStatus: 'NONE' }, { promotionStatus: null }] },
        include: { Renamedclass: true }
      });

      // Get latest 4th term exam marks (for Class 1-9 only)
      const examMarks = await prisma.exammark.findMany({
        where: { student: { schoolId }, examTerminal: { contains: '4th' } }
      });

      const resultMap = {};
      for (const mark of examMarks) {
        if (!resultMap[mark.studentId]) resultMap[mark.studentId] = { isFail: false, hasMarks: true };
        if (['FAIL', 'FAILED'].includes(mark.status)) resultMap[mark.studentId].isFail = true;
      }

      const promoYear = currentYear + 1;
      let promoted = 0, pendingReview = 0, skipped = 0, graduated = 0;

      for (const student of students) {
        if (!student.Renamedclass) { skipped++; continue; }
        const level = parseInt(student.Renamedclass.name);
        if (isNaN(level)) { skipped++; continue; }

        if (level >= FINAL_CLASS_LEVEL) {
          // CLASS 10: Auto-graduate ALL students regardless of exam results
          const gradLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
          await prisma.student.update({
            where: { id: student.id },
            data: {
              promotionStatus: 'GRADUATED',
              isApproved: true,
              graduatedAt: new Date(),
              graduationYear: currentYear,
              promotionAcknowledgedAt: null,
              previousClass: gradLabel
            }
          });
          graduated++;

          // Notify parents about graduation — instruct them to sign out
          const parents = await prisma.parent.findMany({
            where: { student: { some: { id: student.id } } }
          });
          if (parents.length > 0) {
            const schoolName = (await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name || 'the school';
            await prisma.notification.createMany({
              data: parents.map(p => ({
                schoolId,
                parentId: p.id,
                studentId: student.id,
                message: `🎓 Congratulations! ${student.firstName} ${student.lastName} has successfully graduated from ${schoolName} (Class 10). Their academic journey here is complete. Please sign out and contact the school for further information.`,
                type: NT.GRADUATION
              }))
            });
          }
        } else {
          // CLASS 1-9: Normal promotion based on exam results
          const result = resultMap[student.id];
          if (!result || !result.hasMarks) { skipped++; continue; }

          if (!result.isFail) {
            const nextClass = allClasses.find(c => c.name === (level + 1).toString() && c.section === student.Renamedclass.section);
            if (!nextClass) { skipped++; continue; }

            const oldClassId = student.classId;
            const prevLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
            const rollClash = await prisma.student.findFirst({
              where: { classId: nextClass.id, rollNo: student.rollNo, id: { not: student.id } },
              select: { id: true }
            });
            let nextRoll = student.rollNo;
            if (rollClash) {
              const maxR = await prisma.student.aggregate({ where: { classId: nextClass.id }, _max: { rollNo: true } });
              nextRoll = (maxR._max.rollNo || 0) + 1;
            }

            await prisma.$transaction([
              prisma.student.update({
                where: { id: student.id },
                data: { classId: nextClass.id, rollNo: nextRoll, promotionStatus: 'PROMOTED', promotionAcknowledgedAt: null, previousClass: prevLabel }
              }),
              prisma.enrollment.upsert({
                where: { studentId_classId_year: { studentId: student.id, classId: nextClass.id, year: promoYear } },
                update: {},
                create: { studentId: student.id, classId: nextClass.id, year: promoYear }
              })
            ]);

            // Data reset for promoted student
            const oldAssignments = await prisma.assignment.findMany({
              where: { classId: oldClassId },
              select: { id: true }
            });
            const oldAssignmentIds = oldAssignments.map(a => a.id);
            if (oldAssignmentIds.length > 0) {
              await prisma.submission.deleteMany({
                where: { studentId: student.id, assignmentId: { in: oldAssignmentIds } }
              });
            }
            await prisma.studentmaterialstatus.deleteMany({ where: { studentId: student.id } });
            await prisma.quizresponse.deleteMany({ where: { studentId: student.id } });
            await prisma.attendance.deleteMany({ where: { studentId: student.id } });

            // Notify parents of class 1-9 students about promotion to next class
            const nextClassName = nextClass.name;
            const currentClassName = `${student.Renamedclass.name}${student.Renamedclass.section}`;
            const promParents = await prisma.parent.findMany({
              where: { student: { some: { id: student.id } } }
            });
            if (promParents.length > 0) {
              await prisma.notification.createMany({
                data: promParents.map(p => ({
                  schoolId,
                  parentId: p.id,
                  studentId: student.id,
                  message: `🎉 Congratulations! ${student.firstName} ${student.lastName} has been promoted from Class ${currentClassName} to Class ${nextClassName}${student.Renamedclass.section}. Your child will start the new academic year in their new class.`,
                  type: NT.PROMOTION
                }))
              });
            }

            promoted++;
          } else {
            await prisma.student.update({
              where: { id: student.id },
              data: { promotionStatus: 'PENDING', isApproved: false, promotionAcknowledgedAt: null }
            });
            pendingReview++;
          }
        }
      }

      promotionResult = { promoted, pendingReview, skipped, graduated };
    }

    // ── PHASE 2: Lock old session settings ──
    const updateData = {
      activePerformanceSession: nextSession,
      activePerformanceYear: nextYear
    };

    // Disable ratings when session ends (admin re-enables for new session)
    if (school.ratingsEnabled) {
      updateData.ratingsEnabled = false;
      updateData.activeRatingSession = null;
      updateData.activeRatingYear = null;
    }

    await prisma.school.update({ where: { id: schoolId }, data: updateData });

    // New year resets if transitioning to 1st Session
    if (nextSession === '1st Session') {
      await prisma.student.updateMany({
        where: { schoolId, promotionStatus: { notIn: ['GRADUATED'] } },
        data: { promotionStatus: 'NONE' }
      });
      await prisma.exammark.deleteMany({
        where: { student: { schoolId } }
      });
      await prisma.classexamsubmission.deleteMany({
        where: { Renamedclass: { schoolId } }
      });
      await prisma.subjectexamsubmission.deleteMany({
        where: { Renamedclass: { schoolId } }
      });
      await prisma.schoolexampublish.deleteMany({
        where: { schoolId }
      });
      await prisma.sessioncompletion.deleteMany({
        where: { schoolId }
      });
      await prisma.rating.deleteMany({
        where: { teacher: { schoolId } }
      });
      await prisma.potentialmetric.deleteMany({
        where: { student: { schoolId } }
      });
    }

    // ── PHASE 3: Notify school ──
    await prisma.notification.create({
      data: {
        schoolId,
        message: `Session advanced: ${currentSession} (${currentYear}) → ${nextSession} (${nextYear}).${isFourthSession ? ` Promotion completed: ${promotionResult.promoted} promoted, ${promotionResult.graduated} graduated, ${promotionResult.pendingReview} pending review.` : ''}`,
        type: NT.SESSION_ADVANCE
      }
    });

    res.json({
      ok: true,
      from: currentSession,
      to: nextSession,
      year: nextYear,
      isFourthSession,
      promotion: promotionResult
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to advance session' });
  }
});

// Get exam results for a class + terminal (results viewer modal)
router.get('/classes/:classId/results', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const classId = parseInt(req.params.classId);
    const { terminal } = req.query;

    if (!terminal) return res.status(400).json({ error: 'terminal query param required' });

    const cls = await prisma.renamedclass.findFirst({ where: { id: classId, schoolId } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const students = await prisma.student.findMany({
      where: { classId, schoolId },
      select: { id: true, firstName: true, lastName: true, studentCode: true, rollNo: true },
      orderBy: { rollNo: 'asc' }
    });

    const allMarks = await prisma.exammark.findMany({
      where: { studentId: { in: students.map(s => s.id) }, examTerminal: terminal },
      include: { subject: { select: { name: true } } }
    });

    const subjectSet = new Map();
    for (const m of allMarks) {
      if (!subjectSet.has(m.subjectId)) subjectSet.set(m.subjectId, m.subject.name);
    }
    const subjects = Array.from(subjectSet.entries()).map(([id, name]) => ({ id, name }));

    const rows = students.map(s => {
      const studentMarks = allMarks.filter(m => m.studentId === s.id);
      const subjectMarks = {};
      let totalObtained = 0, totalFull = 0, hasFail = false;
      for (const m of studentMarks) {
        subjectMarks[m.subjectId] = { marks: m.marks, fullMarks: m.fullMarks, status: m.status };
        totalObtained += m.marks || 0;
        totalFull += m.fullMarks || 100;
        if (m.status === 'FAILED') hasFail = true;
      }
      const percentage = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        rollNo: s.rollNo,
        code: s.studentCode,
        subjectMarks,
        totalObtained,
        totalFull,
        percentage,
        overallStatus: studentMarks.length === 0 ? 'PENDING' : percentage >= 50 ? 'PASS' : 'FAIL'
      };
    });

    const submitted = rows.filter(r => r.overallStatus !== 'PENDING');
    const passed = submitted.filter(r => r.overallStatus === 'PASS').length;
    const classAvg = submitted.length > 0 ? Math.round(submitted.reduce((a, r) => a + r.percentage, 0) / submitted.length) : 0;

    res.json({
      ok: true,
      data: {
        class: { id: cls.id, name: cls.name, section: cls.section },
        terminal,
        subjects,
        rows,
        summary: { total: students.length, passed, failed: submitted.length - passed, avg: classAvg }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// ================= CLASS PROMOTION SYSTEM =================

// GET /promotions — List all students with promotion context
router.get('/promotions', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const { classId } = req.query;

    const where = { schoolId, isApproved: true };
    if (classId) where.classId = parseInt(classId);

    const students = await prisma.student.findMany({
      where,
      include: {
        Renamedclass: { select: { id: true, name: true, section: true } },
        user: { select: { firstName: true, lastName: true, email: true, username: true } }
      },
      orderBy: [{ classId: 'asc' }, { rollNo: 'asc' }]
    });

    // Also fetch PENDING (failed, unapproved) students
    const pendingWhere = { schoolId, isApproved: false, promotionStatus: 'PENDING' };
    if (classId) pendingWhere.classId = parseInt(classId);

    const pendingStudents = await prisma.student.findMany({
      where: pendingWhere,
      include: {
        Renamedclass: { select: { id: true, name: true, section: true } },
        user: { select: { firstName: true, lastName: true, email: true, username: true } }
      },
      orderBy: [{ classId: 'asc' }, { rollNo: 'asc' }]
    });

    const allStudents = [...students, ...pendingStudents];

    // Get the school's active exam terminal to determine the latest results
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceSession: true, activePerformanceYear: true }
    });

    // Get the latest published terminal for this school (Class 1-9 results)
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });

    // Get 4th terminal specifically for Class 10 results
    const fourthTermPublishRecord = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED', examTerminal: { contains: '4th' } }
    });

    // Fetch exam marks for the latest terminal (Class 1-9)
    let examMarks = [];
    if (latestPublish) {
      examMarks = await prisma.exammark.findMany({
        where: {
          student: { schoolId },
          examTerminal: latestPublish.examTerminal
        },
        include: { subject: { select: { name: true } } }
      });
    }

    // Fetch exam marks for the 4th terminal specifically (Class 10)
    let class10ExamMarks = [];
    if (fourthTermPublishRecord) {
      class10ExamMarks = await prisma.exammark.findMany({
        where: {
          student: { schoolId },
          examTerminal: fourthTermPublishRecord.examTerminal
        },
        include: { subject: { select: { name: true } } }
      });
    }

    // Build a map: studentId → { totalObtained, totalFull, percentage, status, subjectCount } for Class 1-9
    const marksMap = {};
    for (const mark of examMarks) {
      if (!marksMap[mark.studentId]) {
        marksMap[mark.studentId] = { totalObtained: 0, totalFull: 0, isFail: false, subjectCount: 0 };
      }
      marksMap[mark.studentId].totalObtained += mark.marks || 0;
      marksMap[mark.studentId].totalFull += mark.fullMarks || 100;
      marksMap[mark.studentId].subjectCount++;
      if (['FAIL', 'FAILED'].includes(mark.status)) marksMap[mark.studentId].isFail = true;
    }

    // Build a map for Class 10 specifically (4th term)
    const class10MarksMap = {};
    for (const mark of class10ExamMarks) {
      if (!class10MarksMap[mark.studentId]) {
        class10MarksMap[mark.studentId] = { totalObtained: 0, totalFull: 0, isFail: false, subjectCount: 0 };
      }
      class10MarksMap[mark.studentId].totalObtained += mark.marks || 0;
      class10MarksMap[mark.studentId].totalFull += mark.fullMarks || 100;
      class10MarksMap[mark.studentId].subjectCount++;
      if (['FAIL', 'FAILED'].includes(mark.status)) class10MarksMap[mark.studentId].isFail = true;
    }

    // Get all classes for "next class" lookup
    let allClasses = await prisma.renamedclass.findMany({
      where: { schoolId },
      select: { id: true, name: true, section: true }
    });

    const FINAL_CLASS_LEVEL = 10;

    // Auto-create any missing next class levels so promotions work immediately
    for (const s of allStudents) {
      if (s.Renamedclass) {
        const lvl = parseInt(s.Renamedclass.name);
        if (!isNaN(lvl) && lvl < FINAL_CLASS_LEVEL) {
          const nextLvlStr = (lvl + 1).toString();
          const sect = s.Renamedclass.section;
          let exists = allClasses.find(c => c.name === nextLvlStr && c.section === sect);
          if (!exists) {
            try {
              const newClass = await prisma.renamedclass.create({
                data: { name: nextLvlStr, section: sect, schoolId },
                select: { id: true, name: true, section: true }
              });
              allClasses.push(newClass);
            } catch (err) {
              console.error('[AUTO-CLASS] Failed to create class:', err);
            }
          }
        }
      }
    }

    const data = allStudents.map(s => {
      const level = s.Renamedclass ? parseInt(s.Renamedclass.name) : NaN;
      const isClass10OrAbove = !isNaN(level) && level >= FINAL_CLASS_LEVEL;

      // Class 10 students use 4th terminal marks specifically, others use latest published terminal
      const marks = isClass10OrAbove ? class10MarksMap[s.id] : marksMap[s.id];
      const percentage = marks && marks.totalFull > 0
        ? ((marks.totalObtained / marks.totalFull) * 100).toFixed(1)
        : null;
      const resultStatus = percentage !== null ? (percentage >= 50 ? 'PASS' : 'FAIL') : null;

      // Determine next class (null for Class 10 — they graduate)
      let nextClass = null;
      let isGraduationEligible = false;
      if (s.Renamedclass) {
        if (isClass10OrAbove) {
          // Class 10 students don't have a next class — they graduate
          isGraduationEligible = resultStatus === 'PASS';
        } else {
          if (!isNaN(level)) {
            const next = allClasses.find(c => c.name === (level + 1).toString() && c.section === s.Renamedclass.section);
            if (next) nextClass = { id: next.id, name: next.name, section: next.section };
          }
        }
      }

      return {
        id: s.id,
        studentCode: s.studentCode,
        rollNo: s.rollNo,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.user?.email || s.email,
        username: s.user?.username,
        currentClass: s.Renamedclass ? { id: s.Renamedclass.id, name: s.Renamedclass.name, section: s.Renamedclass.section } : null,
        nextClass,
        isGraduationEligible,
        promotionStatus: s.promotionStatus || 'NONE',
        isApproved: s.isApproved,
        percentage: percentage ? parseFloat(percentage) : null,
        resultStatus,
        subjectCount: marks?.subjectCount || 0
      };
    });

    // Summary stats
    const summary = {
      total: data.length,
      promoted: data.filter(d => d.promotionStatus === 'PROMOTED').length,
      retained: data.filter(d => d.promotionStatus === 'RETAINED').length,
      pending: data.filter(d => d.promotionStatus === 'PENDING').length,
      graduated: data.filter(d => d.promotionStatus === 'GRADUATED').length,
      none: data.filter(d => d.promotionStatus === 'NONE').length
    };

    // Check if 4th Term specifically is published AND calculated
    const fourthTermPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, examTerminal: { contains: '4th' } }
    });
    const is4thTermPublished = fourthTermPublish?.status === 'PUBLISHED';
    const is4thTermCalculated = fourthTermPublish?.calculationStatus === 'COMPLETED';

    // Split data: Class 1-9 vs Class 10
    const class1to9 = data.filter(s => {
      const lvl = parseInt(s.currentClass?.name);
      return !isNaN(lvl) && lvl < FINAL_CLASS_LEVEL;
    });
    const class10 = data.filter(s => {
      const lvl = parseInt(s.currentClass?.name);
      return !isNaN(lvl) && lvl >= FINAL_CLASS_LEVEL;
    });

    res.json({
      ok: true,
      data,
      class1to9,
      class10,
      summary,
      latestTerminal: latestPublish?.examTerminal || null,
      isResultPublished: latestPublish?.status === 'PUBLISHED',
      is4thTermPublished,
      is4thTermCalculated,
      promotionReady: is4thTermPublished && is4thTermCalculated,
      activeSession: school?.activePerformanceSession || null,
      activeTerminal: school?.activePerformanceSession ? school.activePerformanceSession.replace('Session', 'Term') : null,
      classes: allClasses.sort((a, b) => parseInt(a.name) - parseInt(b.name) || a.section.localeCompare(b.section))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch promotion data' });
  }
});

// POST /promotions/:studentId/promote — Admin manually promotes a student
router.post('/promotions/:studentId/promote', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const studentId = parseInt(req.params.studentId);

    // Guard: check if results are published
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });
    if (!latestPublish) {
      return res.status(400).json({ error: 'Results must be published before promotion' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { Renamedclass: true }
    });

    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.promotionStatus === 'PROMOTED') {
      return res.status(400).json({ error: 'Student is already promoted' });
    }

    if (student.promotionStatus === 'GRADUATED') {
      return res.status(400).json({ error: 'Student has already graduated' });
    }

    const currentName = student.Renamedclass?.name;
    const currentSection = student.Renamedclass?.section;
    const currentLevel = parseInt(currentName);

    if (isNaN(currentLevel)) {
      return res.status(400).json({ error: 'Invalid class level for promotion' });
    }

    // Nepal school system: Class 10 is the final class
    const FINAL_CLASS_LEVEL = 10;
    if (currentLevel >= FINAL_CLASS_LEVEL) {
      return res.status(400).json({ error: 'Class 10 students cannot be promoted further. Use graduation instead.' });
    }

    const nextLevel = currentLevel + 1;
    const nextClassName = nextLevel.toString();

    let nextClass = await prisma.renamedclass.findFirst({
      where: { name: nextClassName, section: currentSection, schoolId }
    });

    if (!nextClass) {
      try {
        nextClass = await prisma.renamedclass.create({
          data: { name: nextClassName, section: currentSection, schoolId }
        });
      } catch (err) {
        return res.status(500).json({ error: `Failed to automatically create next class: ${nextClassName}${currentSection}` });
      }
    }

    const schoolConfig = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceYear: true }
    });
    const promoYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;

    const oldClassId = student.classId;

    const previousClassLabel = currentName && currentSection ? `${currentName}${currentSection}` : null;

    // Resolve rollNo collision: the unique (classId, rollNo) constraint can clash with
    // an already-graduated student who still occupies that slot in the next class.
    const collision = await prisma.student.findFirst({
      where: { classId: nextClass.id, rollNo: student.rollNo, id: { not: studentId } },
      select: { id: true }
    });
    let nextRollNo = student.rollNo;
    if (collision) {
      const maxRoll = await prisma.student.aggregate({
        where: { classId: nextClass.id },
        _max: { rollNo: true }
      });
      nextRollNo = (maxRoll._max.rollNo || 0) + 1;
    }

    await prisma.$transaction([
      prisma.student.update({
        where: { id: studentId },
        data: {
          classId: nextClass.id,
          rollNo: nextRollNo,
          isApproved: true,
          promotionStatus: 'PROMOTED',
          promotionAcknowledgedAt: null,
          previousClass: previousClassLabel
        }
      }),
      prisma.enrollment.upsert({
        where: { studentId_classId_year: { studentId, classId: nextClass.id, year: promoYear } },
        update: {},
        create: { studentId, classId: nextClass.id, year: promoYear }
      })
    ]);

    // ── DATA RESET: Clean old class data for promoted student ──
    // Delete assignment submissions for this student
    const oldAssignments = await prisma.assignment.findMany({
      where: { classId: oldClassId },
      select: { id: true }
    });
    const oldAssignmentIds = oldAssignments.map(a => a.id);
    if (oldAssignmentIds.length > 0) {
      await prisma.submission.deleteMany({
        where: { studentId, assignmentId: { in: oldAssignmentIds } }
      });
    }

    // Delete study material progress
    await prisma.studentmaterialstatus.deleteMany({
      where: { studentId }
    });

    // Delete quiz responses
    await prisma.quizresponse.deleteMany({
      where: { studentId }
    });

    // Delete attendance records
    await prisma.attendance.deleteMany({
      where: { studentId }
    });

    // NOTE: Exam marks, SWOT feedback, ratings, parent linkage are KEPT for historical record

    // Notify parents
    const parents = await prisma.parent.findMany({
      where: { student: { some: { id: studentId } } }
    });
    if (parents.length > 0) {
      await prisma.notification.createMany({
        data: parents.map(p => ({
          schoolId,
          parentId: p.id,
          studentId,
          message: `${student.firstName} ${student.lastName} has been promoted to Class ${nextClassName}${currentSection}.`,
          type: NT.PROMOTION
        }))
      });
    }

    res.json({ ok: true, message: `Student promoted to Class ${nextClassName}${currentSection}` });
  } catch (err) {
    console.error('promote student error:', err);
    res.status(500).json({ error: err?.message ? `Failed to promote student: ${err.message}` : 'Failed to promote student' });
  }
});

// POST /promotions/:studentId/retain — Admin retains student in same class
router.post('/promotions/:studentId/retain', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const studentId = parseInt(req.params.studentId);

    // Guard: check if results are published
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });
    if (!latestPublish) {
      return res.status(400).json({ error: 'Results must be published before promotion' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { Renamedclass: true }
    });

    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.promotionStatus === 'RETAINED') {
      return res.status(400).json({ error: 'Student is already retained' });
    }

    // For retain the student stays in the same class — mirror previousClass = currentClass
    const retainClassLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;

    // Update student status — no new enrollment record (prevent duplicates)
    await prisma.student.update({
      where: { id: studentId },
      data: {
        isApproved: true,
        promotionStatus: 'RETAINED',
        promotionAcknowledgedAt: null,
        previousClass: retainClassLabel
      }
    });

    // Update existing enrollment record instead of creating a duplicate
    await prisma.enrollment.updateMany({
      where: { studentId, classId: student.classId },
      data: { year: (await prisma.school.findUnique({ where: { id: schoolId }, select: { activePerformanceYear: true } }))?.activePerformanceYear || new Date().getFullYear() }
    });

    res.json({ ok: true, message: 'Student retained in the same class' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retain student' });
  }
});

// POST /promotions/:studentId/graduate — Admin manually graduates a Class 10 student
router.post('/promotions/:studentId/graduate', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);
    const studentId = parseInt(req.params.studentId);

    // Guard: check if results are published
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });
    if (!latestPublish) {
      return res.status(400).json({ error: 'Results must be published before promotion' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { Renamedclass: true, parent: true }
    });

    if (!student || student.schoolId !== schoolId) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.promotionStatus === 'GRADUATED') {
      return res.status(400).json({ error: 'Student has already graduated' });
    }

    const currentLevel = parseInt(student.Renamedclass?.name);
    const FINAL_CLASS_LEVEL = 10;

    if (isNaN(currentLevel) || currentLevel < FINAL_CLASS_LEVEL) {
      return res.status(400).json({ error: 'Only Class 10 students can be graduated.' });
    }

    const schoolForYear = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, activePerformanceYear: true }
    });
    const graduationYearValue = schoolForYear?.activePerformanceYear || new Date().getFullYear();

    const graduateClassLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;

    await prisma.student.update({
      where: { id: studentId },
      data: {
        promotionStatus: 'GRADUATED',
        isApproved: true,
        graduatedAt: new Date(),
        graduationYear: graduationYearValue,
        promotionAcknowledgedAt: null,
        previousClass: graduateClassLabel
      }
    });

    const school = schoolForYear;

    // Notify parents about graduation
    if (student.parent && student.parent.length > 0) {
      await prisma.notification.createMany({
        data: student.parent.map(p => ({
          schoolId,
          parentId: p.id,
          studentId,
          message: `Congratulations! ${student.firstName} ${student.lastName} has graduated from ${school?.name || 'the school'}.`,
          type: NT.GRADUATION
        }))
      });
    }

    res.json({ ok: true, message: `${student.firstName} ${student.lastName} has been graduated successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to graduate student' });
  }
});

// POST /promotions/bulk — Process remaining students (safe manual fallback)
// Only processes students with NONE or PENDING status — never re-processes already actioned students
router.post('/promotions/bulk', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    // Only get students not yet actioned (NONE or PENDING) — skip PROMOTED/GRADUATED/RETAINED
    const students = await prisma.student.findMany({
      where: { schoolId, promotionStatus: { in: ['NONE', 'PENDING'] } },
      include: { Renamedclass: true }
    });

    // Get latest published terminal
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });

    if (!latestPublish) {
      return res.status(400).json({ error: 'No published results found. Publish terminal results first.' });
    }

    // Check if it's a 4th term
    if (!latestPublish.examTerminal.toLowerCase().includes('4th')) {
      return res.status(400).json({ error: 'Bulk promotion is only available after 4th Term results are published.' });
    }

    const examMarks = await prisma.exammark.findMany({
      where: { student: { schoolId }, examTerminal: latestPublish.examTerminal }
    });

    // Build pass/fail map
    const resultMap = {};
    for (const mark of examMarks) {
      if (!resultMap[mark.studentId]) resultMap[mark.studentId] = { isFail: false, hasMarks: true };
      if (['FAIL', 'FAILED'].includes(mark.status)) resultMap[mark.studentId].isFail = true;
    }

    const allClasses = await prisma.renamedclass.findMany({ where: { schoolId } });
    const schoolConfig = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { activePerformanceYear: true }
    });
    const promoYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;

    const FINAL_CLASS_LEVEL = 10;
    let promoted = 0;
    let pendingReview = 0;
    let skipped = 0;
    let graduated = 0;

    for (const student of students) {
      const result = resultMap[student.id];
      if (!result || !result.hasMarks) { skipped++; continue; }

      if (!result.isFail && student.Renamedclass) {
        // PASSED
        const level = parseInt(student.Renamedclass.name);
        if (isNaN(level)) { skipped++; continue; }

        const prevLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;

        if (level >= FINAL_CLASS_LEVEL) {
          // GRADUATION: Class 10 students who pass are graduated
          await prisma.student.update({
            where: { id: student.id },
            data: {
              promotionStatus: 'GRADUATED',
              graduatedAt: new Date(),
              graduationYear: schoolConfig?.activePerformanceYear || new Date().getFullYear(),
              promotionAcknowledgedAt: null,
              previousClass: prevLabel
            }
          });
          graduated++;
        } else {
          // PROMOTION: Move to next class
          const nextClass = allClasses.find(c => c.name === (level + 1).toString() && c.section === student.Renamedclass.section);
          if (!nextClass) { skipped++; continue; }

          const oldClassId = student.classId;
          const rollClash = await prisma.student.findFirst({
            where: { classId: nextClass.id, rollNo: student.rollNo, id: { not: student.id } },
            select: { id: true }
          });
          let nextRoll = student.rollNo;
          if (rollClash) {
            const maxR = await prisma.student.aggregate({ where: { classId: nextClass.id }, _max: { rollNo: true } });
            nextRoll = (maxR._max.rollNo || 0) + 1;
          }

          await prisma.$transaction([
            prisma.student.update({
              where: { id: student.id },
              data: { classId: nextClass.id, rollNo: nextRoll, promotionStatus: 'PROMOTED', promotionAcknowledgedAt: null, previousClass: prevLabel }
            }),
            prisma.enrollment.upsert({
              where: { studentId_classId_year: { studentId: student.id, classId: nextClass.id, year: promoYear } },
              update: {},
              create: { studentId: student.id, classId: nextClass.id, year: promoYear }
            })
          ]);

          // Data reset for promoted student (keep exam marks, SWOT, ratings, parent link)
          const oldAssignments = await prisma.assignment.findMany({
            where: { classId: oldClassId },
            select: { id: true }
          });
          const oldAssignmentIds = oldAssignments.map(a => a.id);
          if (oldAssignmentIds.length > 0) {
            await prisma.submission.deleteMany({
              where: { studentId: student.id, assignmentId: { in: oldAssignmentIds } }
            });
          }
          await prisma.studentmaterialstatus.deleteMany({ where: { studentId: student.id } });
          await prisma.quizresponse.deleteMany({ where: { studentId: student.id } });
          await prisma.attendance.deleteMany({ where: { studentId: student.id } });

          promoted++;
        }
      } else if (result.isFail) {
        // FAILED — tag for review
        await prisma.student.update({
          where: { id: student.id },
          data: { promotionStatus: 'PENDING', isApproved: false, promotionAcknowledgedAt: null }
        });
        pendingReview++;
      }
    }

    res.json({
      ok: true,
      message: `Bulk promotion complete: ${promoted} promoted, ${graduated} graduated, ${pendingReview} sent for review, ${skipped} skipped (no results or no next class).`,
      promoted,
      graduated,
      pendingReview,
      skipped
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run bulk promotion' });
  }
});

// ── Graduation / Completion History ──────────────────────────────
router.get('/graduations', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    const graduated = await prisma.student.findMany({
      where: { schoolId, promotionStatus: 'GRADUATED' },
      include: {
        Renamedclass: { select: { name: true, section: true } },
        user: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: [{ graduatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({
      ok: true,
      data: graduated.map(s => ({
        id: s.id,
        studentCode: s.studentCode,
        name: `${s.firstName} ${s.lastName}`,
        email: s.user?.email || s.email,
        lastClass: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section}` : '—',
        rollNo: s.rollNo,
        graduatedAt: s.graduatedAt || s.createdAt,
        graduationYear: s.graduationYear,
        promotionAcknowledgedAt: s.promotionAcknowledgedAt
      })),
      total: graduated.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch graduations' });
  }
});

// GET /graduated-batches — graduated students grouped by graduation year (Batch of YYYY)
router.get('/graduated-batches', async (req, res) => {
  try {
    const schoolId = await getAdminSchoolId(req.user.userId);

    const graduated = await prisma.student.findMany({
      where: { schoolId, promotionStatus: 'GRADUATED' },
      include: {
        Renamedclass: { select: { name: true, section: true } },
        user: { select: { email: true } }
      },
      orderBy: [{ graduatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    const batches = new Map();
    for (const s of graduated) {
      const year = s.graduationYear ||
        (s.graduatedAt ? new Date(s.graduatedAt).getFullYear() : new Date(s.createdAt).getFullYear());
      if (!batches.has(year)) batches.set(year, []);
      batches.get(year).push({
        id: s.id,
        studentCode: s.studentCode,
        name: `${s.firstName} ${s.lastName}`,
        email: s.user?.email || s.email,
        lastClass: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section}` : '—',
        rollNo: s.rollNo,
        graduatedAt: s.graduatedAt || s.createdAt,
        promotionAcknowledgedAt: s.promotionAcknowledgedAt
      });
    }

    const data = Array.from(batches.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, students]) => ({
        year,
        label: `Batch of ${year}`,
        count: students.length,
        students
      }));

    res.json({ ok: true, data, total: graduated.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch graduated batches' });
  }
});

module.exports = router;

