const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const generateCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const hash = (pw) => bcrypt.hash(pw, 10);

// date helper: month is 1-based
const d = (y, m, day) => new Date(y, m - 1, day);

// ─── CLEAN OLD DEMO DATA ────────────────────────────────────────────────────
async function clean() {
  const usernames = [
    'admin_demo',
    'teacher_math', 'teacher_science', 'teacher_english', 'teacher_cs', 'teacher_hindi',
    'teacher_pending1', 'teacher_pending2',
    'student_rahul', 'student_priya', 'student_dev', 'student_ananya',
    'student_aarav', 'student_meera', 'student_kabir', 'student_ishaan',
    'student_arjun', 'student_riya', 'student_kavya',
    'student_tanvi', 'student_aryan', 'student_sneha', 'student_neel',
    'parent_sharma', 'parent_kumar', 'parent_patel', 'parent_gupta', 'parent_singh',
  ];

  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin_demo' } });
  if (!existingAdmin) { console.log('No existing demo data, starting fresh.\n'); return; }

  console.log('Cleaning existing demo data...');

  const school =
    await prisma.school.findFirst({ where: { adminId: existingAdmin.id } }) ||
    await prisma.school.findFirst({ where: { code: { in: ['SS01', 'DEMO', 'DM12'] } } });

  if (school) {
    const schoolId = school.id;

    const studentIds = (await prisma.student.findMany({ where: { schoolId }, select: { id: true } })).map(s => s.id);
    if (studentIds.length) {
      await prisma.quizresponse.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.submission.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.exammark.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.rating.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.feedback.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.feedbackrequest.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.teachermessage.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.enrollment.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.fee.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.studentmaterialstatus.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.potentialmetric.deleteMany({ where: { studentId: { in: studentIds } } });
    }

    const classIds = (await prisma.renamedclass.findMany({ where: { schoolId }, select: { id: true } })).map(c => c.id);
    if (classIds.length) {
      const matIds = (await prisma.studymaterial.findMany({ where: { classId: { in: classIds } }, select: { id: true } })).map(m => m.id);
      if (matIds.length) {
        const qsIds = (await prisma.quizset.findMany({ where: { studyMaterialId: { in: matIds } }, select: { id: true } })).map(q => q.id);
        if (qsIds.length) await prisma.question.deleteMany({ where: { quizSetId: { in: qsIds } } });
        await prisma.quizset.deleteMany({ where: { studyMaterialId: { in: matIds } } });
        await prisma.studymaterial.deleteMany({ where: { id: { in: matIds } } });
      }
      await prisma.assignment.deleteMany({ where: { classId: { in: classIds } } });
      await prisma.subjectexamsubmission.deleteMany({ where: { classId: { in: classIds } } });
      await prisma.classexamsubmission.deleteMany({ where: { classId: { in: classIds } } });
      await prisma.sessioncompletion.deleteMany({ where: { classId: { in: classIds } } });
      await prisma.teachersubject.deleteMany({ where: { classId: { in: classIds } } });
    }

    await prisma.notification.deleteMany({ where: { schoolId } });
    await prisma.schoolexampublish.deleteMany({ where: { schoolId } });

    // Clean admin inbox messages (from/to demo users)
    const demoUserIds = (await prisma.user.findMany({ where: { username: { in: usernames } }, select: { id: true } })).map(u => u.id);
    if (demoUserIds.length) {
      await prisma.message.deleteMany({ where: { OR: [{ fromUserId: { in: demoUserIds } }, { toUserId: { in: demoUserIds } }] } });
      await prisma.schoolcoderequest.deleteMany({ where: { userId: { in: demoUserIds } } });
      await prisma.passwordresetrequest.deleteMany({ where: { userId: { in: demoUserIds } } });
    }

    if (classIds.length) await prisma.renamedclass.updateMany({ where: { id: { in: classIds } }, data: { classHeadId: null } });
    if (studentIds.length) await prisma.student.updateMany({ where: { id: { in: studentIds } }, data: { classId: null } });
    await prisma.student.deleteMany({ where: { schoolId } });
    await prisma.parent.deleteMany({ where: { schoolId } });
    await prisma.teacher.deleteMany({ where: { schoolId } });
    await prisma.renamedclass.deleteMany({ where: { schoolId } });
    await prisma.subject.deleteMany({ where: { schoolId } });
    await prisma.school.update({ where: { id: schoolId }, data: { adminId: null } });
    await prisma.school.delete({ where: { id: schoolId } });
  }

  await prisma.user.deleteMany({ where: { username: { in: usernames } } });
  console.log('Cleaned ✅\n');
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding School Space demo data...\n');
  await clean();

  const PW = 'Demo@1234';

  // ── ADMIN + SCHOOL ────────────────────────────────────────────────────────
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin_demo', password: await hash(PW),
      firstName: 'Demo', lastName: 'Admin',
      email: 'admin@schoolspace.demo',
      role: 'ADMIN', emailVerified: true, isActive: true,
    },
  });

  const school = await prisma.school.create({
    data: {
      name: 'School Space Academy', code: 'SS01',
      email: 'admin@schoolspace.demo', adminId: adminUser.id,
      ratingsEnabled: true, studentAnalyticsEnabled: true,
      parentMessagingEnabled: true, multiClassTeachersEnabled: true,
      activeExamTerminal:        '1st Term',
      activeRatingSession:       '1st Session', activeRatingYear:       2026,
      activePerformanceSession:  '1st Session', activePerformanceYear:  2026,
    },
  });

  await prisma.user.update({ where: { id: adminUser.id }, data: { schoolId: school.id } });
  const schoolId = school.id;
  console.log(`School : ${school.name}  (SS01) ✅`);

  // ── SUBJECTS ──────────────────────────────────────────────────────────────
  const SUBJ_NAMES = ['Mathematics', 'Science', 'English', 'History', 'Computer Science', 'Hindi'];
  const subjects = {};
  for (const name of SUBJ_NAMES) {
    subjects[name] = await prisma.subject.create({ data: { name, schoolId } });
  }
  console.log('Subjects (6) created ✅');

  // ── CLASSES ───────────────────────────────────────────────────────────────
  const classDefs = [
    { key: '10A', name: '10', section: 'A' },
    { key: '10B', name: '10', section: 'B' },
    { key: '9A',  name: '9',  section: 'A' },
    { key: '9B',  name: '9',  section: 'B' },
  ];
  const classes = {};
  for (const c of classDefs) {
    classes[c.key] = await prisma.renamedclass.create({ data: { name: c.name, section: c.section, schoolId } });
  }
  console.log('Classes (4) created ✅');

  // ── TEACHERS ──────────────────────────────────────────────────────────────
  const teacherDefs = [
    { username: 'teacher_math',    firstName: 'Amit',   lastName: 'Verma', subjects: ['Mathematics'],         classes: ['10A', '10B'],         classHead: '10A' },
    { username: 'teacher_science', firstName: 'Sunita', lastName: 'Rao',   subjects: ['Science'],             classes: ['10A', '10B'],         classHead: '10B' },
    { username: 'teacher_english', firstName: 'Vikram', lastName: 'Nair',  subjects: ['English', 'History'],  classes: ['10A', '9A'],          classHead: '9A'  },
    { username: 'teacher_cs',      firstName: 'Neha',   lastName: 'Gupta', subjects: ['Computer Science'],    classes: ['10A', '10B', '9A', '9B'], classHead: '9B' },
    { username: 'teacher_hindi',   firstName: 'Rajan',  lastName: 'Mehta', subjects: ['Hindi'],               classes: ['9A', '9B'],           classHead: null  },
  ];

  const teachers = {};
  for (const t of teacherDefs) {
    const uRec = await prisma.user.create({
      data: {
        username: t.username, password: await hash(PW),
        firstName: t.firstName, lastName: t.lastName,
        email: `${t.username}@schoolspace.demo`,
        role: 'TEACHER', emailVerified: true, isActive: true, schoolId,
      },
    });
    const tRec = await prisma.teacher.create({
      data: { userId: uRec.id, schoolId, status: 'ACTIVE', isClassTeacher: true, email: `${t.username}@schoolspace.demo` },
    });
    for (const subjName of t.subjects) {
      for (const clsKey of t.classes) {
        await prisma.teachersubject.create({
          data: { teacherId: tRec.id, subjectId: subjects[subjName].id, classId: classes[clsKey].id },
        });
      }
    }
    if (t.classHead) {
      await prisma.renamedclass.update({ where: { id: classes[t.classHead].id }, data: { classHeadId: tRec.id } });
    }
    teachers[t.username] = tRec;
    console.log(`Teacher : ${t.username} ✅`);
  }

  // Class head teacher key per class (used for attendance + exam marks)
  const classTeacher = { '10A': 'teacher_math', '10B': 'teacher_science', '9A': 'teacher_english', '9B': 'teacher_cs' };

  // ── STUDENT PROFILES ──────────────────────────────────────────────────────
  //
  //  STAR          : high marks (82%), good attendance (93%), on-time submissions, completes materials, correct quizzes
  //  RISING        : low marks (36%), low attendance (60%), on-time but low grades, completes materials, correct quizzes
  //  CONSISTENT    : decent marks (77%), good attendance (88%), on-time submissions, skips materials/quizzes
  //  NEEDS_SUPPORT : low marks (30%), poor attendance (50%), late/missed submissions, no materials/quizzes
  //
  const PROFILES = {
    STAR:          { examMarks: [80, 85, 83, 84, 82, 81], attendance: 0.93, gradeRange: [85, 95], submitOffset: -2, doMaterials: true,  quizRate: 0.90, curiosity: 25 },
    RISING:        { examMarks: [35, 38, 32, 40, 34, 37], attendance: 0.60, gradeRange: [38, 48], submitOffset: -1, doMaterials: true,  quizRate: 0.85, curiosity: 22 },
    CONSISTENT:    { examMarks: [75, 78, 74, 79, 76, 77], attendance: 0.88, gradeRange: [78, 90], submitOffset: -3, doMaterials: false, quizRate: 0.00, curiosity:  4 },
    NEEDS_SUPPORT: { examMarks: [28, 32, 26, 34, 30, 29], attendance: 0.50, gradeRange: [25, 42], submitOffset:  3, doMaterials: false, quizRate: 0.00, curiosity:  0 },
  };

  // Subjects taught per class (determines exam marks subjects)
  const classSubjects = {
    '10A': ['Mathematics', 'Science', 'English', 'History', 'Computer Science'],
    '10B': ['Mathematics', 'Science', 'Computer Science'],
    '9A':  ['English', 'History', 'Computer Science', 'Hindi'],
    '9B':  ['Computer Science', 'Hindi'],
  };

  // Rating subject per class (must be taught in that class)
  const classRatingSubject = { '10A': 'Mathematics', '10B': 'Mathematics', '9A': 'English', '9B': 'Computer Science' };

  // ── STUDENTS ──────────────────────────────────────────────────────────────
  const studentDefs = [
    // 10A — all four quadrants
    { username: 'student_rahul',  firstName: 'Rahul',  lastName: 'Sharma', cls: '10A', rollNo: 1, email: 'rahul@schoolspace.demo',  profile: 'STAR' },
    { username: 'student_priya',  firstName: 'Priya',  lastName: 'Sharma', cls: '10A', rollNo: 2, email: 'priya@schoolspace.demo',  profile: 'RISING' },
    { username: 'student_dev',    firstName: 'Dev',    lastName: 'Singh',  cls: '10A', rollNo: 3, email: 'dev@schoolspace.demo',    profile: 'CONSISTENT' },
    { username: 'student_ananya', firstName: 'Ananya', lastName: 'Sharma', cls: '10A', rollNo: 4, email: 'ananya@schoolspace.demo', profile: 'NEEDS_SUPPORT' },
    // 10B — all four quadrants
    { username: 'student_aarav',  firstName: 'Aarav',  lastName: 'Kumar',  cls: '10B', rollNo: 1, email: 'aarav@schoolspace.demo',  profile: 'STAR' },
    { username: 'student_meera',  firstName: 'Meera',  lastName: 'Patel',  cls: '10B', rollNo: 2, email: 'meera@schoolspace.demo',  profile: 'RISING' },
    { username: 'student_kabir',  firstName: 'Kabir',  lastName: 'Khan',   cls: '10B', rollNo: 3, email: 'kabir@schoolspace.demo',  profile: 'CONSISTENT' },
    { username: 'student_ishaan', firstName: 'Ishaan', lastName: 'Verma',  cls: '10B', rollNo: 4, email: 'ishaan@schoolspace.demo', profile: 'NEEDS_SUPPORT' },
    // 9A — three quadrants (star, rising, needs support)
    { username: 'student_arjun',  firstName: 'Arjun',  lastName: 'Patel',  cls: '9A',  rollNo: 1, email: 'arjun@schoolspace.demo',  profile: 'STAR' },
    { username: 'student_riya',   firstName: 'Riya',   lastName: 'Kapoor', cls: '9A',  rollNo: 2, email: 'riya@schoolspace.demo',   profile: 'RISING' },
    { username: 'student_kavya',  firstName: 'Kavya',  lastName: 'Singh',  cls: '9A',  rollNo: 3, email: 'kavya@schoolspace.demo',  profile: 'NEEDS_SUPPORT' },
    // 9B — all four quadrants
    { username: 'student_neel',   firstName: 'Neel',   lastName: 'Shah',   cls: '9B',  rollNo: 1, email: 'neel@schoolspace.demo',   profile: 'STAR' },
    { username: 'student_sneha',  firstName: 'Sneha',  lastName: 'Joshi',  cls: '9B',  rollNo: 2, email: 'sneha@schoolspace.demo',  profile: 'RISING' },
    { username: 'student_tanvi',  firstName: 'Tanvi',  lastName: 'Reddy',  cls: '9B',  rollNo: 3, email: 'tanvi@schoolspace.demo',  profile: 'CONSISTENT' },
    { username: 'student_aryan',  firstName: 'Aryan',  lastName: 'Mehta',  cls: '9B',  rollNo: 4, email: 'aryan@schoolspace.demo',  profile: 'NEEDS_SUPPORT' },
  ];

  const students = {};
  for (const s of studentDefs) {
    const uRec = await prisma.user.create({
      data: {
        username: s.username, password: await hash(PW),
        firstName: s.firstName, lastName: s.lastName,
        email: s.email, role: 'STUDENT',
        emailVerified: true, isActive: true, schoolId,
      },
    });
    const sRec = await prisma.student.create({
      data: {
        userId: uRec.id, firstName: s.firstName, lastName: s.lastName,
        schoolId, classId: classes[s.cls].id,
        studentCode: generateCode(), rollNo: s.rollNo,
        isApproved: true, email: s.email,
      },
    });
    await prisma.enrollment.create({ data: { studentId: sRec.id, classId: classes[s.cls].id, year: 2026 } });
    students[s.username] = sRec;
    console.log(`Student : ${s.username}  [${s.profile}] ✅`);
  }

  // ── PARENTS ───────────────────────────────────────────────────────────────
  const parentDefs = [
    { username: 'parent_sharma', firstName: 'Rajesh', lastName: 'Sharma', email: 'rajesh.sharma@schoolspace.demo', children: ['student_rahul', 'student_priya'] },
    { username: 'parent_kumar',  firstName: 'Suresh', lastName: 'Kumar',  email: 'suresh.kumar@schoolspace.demo',  children: ['student_aarav'] },
    { username: 'parent_patel',  firstName: 'Dinesh', lastName: 'Patel',  email: 'dinesh.patel@schoolspace.demo',  children: ['student_meera', 'student_arjun'] },
    { username: 'parent_gupta',  firstName: 'Anjali', lastName: 'Gupta',  email: 'anjali.gupta@schoolspace.demo',  children: ['student_dev', 'student_ananya'] },
    { username: 'parent_singh',  firstName: 'Vikram', lastName: 'Singh',  email: 'vikram.singh@schoolspace.demo',  children: ['student_kabir', 'student_tanvi'] },
  ];

  const parents = {};
  for (const p of parentDefs) {
    const uRec = await prisma.user.create({
      data: {
        username: p.username, password: await hash(PW),
        firstName: p.firstName, lastName: p.lastName,
        email: p.email, role: 'PARENT',
        emailVerified: true, isActive: true, schoolId,
      },
    });
    const pRec = await prisma.parent.create({
      data: {
        firstName: p.firstName, lastName: p.lastName,
        email: p.email, schoolId, userId: uRec.id,
        student: { connect: p.children.map(c => ({ id: students[c].id })) },
      },
    });
    parents[p.username] = pRec;
    console.log(`Parent  : ${p.username} ✅`);
  }

  // ── STUDY MATERIALS + QUIZ QUESTIONS ─────────────────────────────────────
  //  2 materials per class. fileUrl = YouTube embed URL (playable via iframe).
  //  thumbnailUrl = YouTube hqdefault thumbnail (no auth required).
  //  Each question has real options; correct answer is always index 0.
  const materialConfig = {
    '10A': [
      {
        title: 'Introduction to Algebra',
        subj: 'Mathematics', teacher: 'teacher_math', deadline: d(2026,1,28),
        description: 'Learn the fundamentals of algebraic expressions, variables, and solving linear equations step by step.',
        fileUrl: 'https://www.youtube.com/embed/NybHckSEQBI',
        thumbnailUrl: 'https://img.youtube.com/vi/NybHckSEQBI/hqdefault.jpg',
        qs: [
          { text: 'What is the value of x in 2x + 4 = 10?', options: ['x = 3', 'x = 5', 'x = 7', 'x = 1'] },
          { text: 'Which of the following is a polynomial expression?', options: ['2x² + 3x − 1', '1/x + 2', '√x + 1', 'x⁻²'] },
          { text: 'Simplify: 3(x + 2) − x', options: ['2x + 6', '4x + 2', '2x + 2', '3x + 6'] },
        ],
      },
      {
        title: "Newton's Laws of Motion",
        subj: 'Science', teacher: 'teacher_science', deadline: d(2026,3,20),
        description: 'Understand the three laws of motion that govern how objects move and interact with forces.',
        fileUrl: 'https://www.youtube.com/embed/kKKM8Y-u7ds',
        thumbnailUrl: 'https://img.youtube.com/vi/kKKM8Y-u7ds/hqdefault.jpg',
        qs: [
          { text: 'Newton\'s First Law states that an object at rest will…', options: ['Stay at rest unless acted on by a force', 'Accelerate uniformly', 'React with equal force', 'Fall due to gravity'] },
          { text: 'Force equals mass multiplied by…', options: ['Acceleration', 'Velocity', 'Speed', 'Weight'] },
          { text: 'Which law describes action and reaction?', options: ['Newton\'s Third Law', 'Newton\'s First Law', 'Newton\'s Second Law', 'Law of Gravity'] },
        ],
      },
    ],
    '10B': [
      {
        title: 'Quadratic Equations',
        subj: 'Mathematics', teacher: 'teacher_math', deadline: d(2026,2,15),
        description: 'Explore how to solve quadratic equations using factoring, completing the square, and the quadratic formula.',
        fileUrl: 'https://www.youtube.com/embed/i7idZfS8t8w',
        thumbnailUrl: 'https://img.youtube.com/vi/i7idZfS8t8w/hqdefault.jpg',
        qs: [
          { text: 'What are the roots of x² − 5x + 6 = 0?', options: ['x = 2 and x = 3', 'x = 1 and x = 6', 'x = −2 and x = −3', 'x = 5 and x = 1'] },
          { text: 'The discriminant of a quadratic ax² + bx + c is:', options: ['b² − 4ac', 'b² + 4ac', '−b/2a', '4ac − b²'] },
          { text: 'Completing the square for x² + 4x gives:', options: ['(x + 2)² − 4', '(x + 4)² − 16', '(x + 2)²', '(x − 2)² + 4'] },
        ],
      },
      {
        title: 'Chemical Reactions',
        subj: 'Science', teacher: 'teacher_science', deadline: d(2026,3,25),
        description: 'Discover the types of chemical reactions, balancing equations, and the law of conservation of mass.',
        fileUrl: 'https://www.youtube.com/embed/7HPJT8-u_6w',
        thumbnailUrl: 'https://img.youtube.com/vi/7HPJT8-u_6w/hqdefault.jpg',
        qs: [
          { text: 'Which is NOT a type of chemical reaction?', options: ['Decomposition into Motion', 'Synthesis', 'Decomposition', 'Single Displacement'] },
          { text: 'When an acid reacts with a base, the products are:', options: ['Salt and water', 'Gas and acid', 'Metal and oxide', 'Carbon dioxide and water'] },
          { text: 'The Law of Conservation of Mass states that mass is:', options: ['Neither created nor destroyed', 'Always increasing', 'Always decreasing', 'Converted to energy'] },
        ],
      },
    ],
    '9A': [
      {
        title: 'English Grammar Essentials',
        subj: 'English', teacher: 'teacher_english', deadline: d(2026,2,10),
        description: 'Master the 8 parts of speech, sentence structure, tenses, and basic punctuation rules.',
        fileUrl: 'https://www.youtube.com/embed/2uyHHGqFYGg',
        thumbnailUrl: 'https://img.youtube.com/vi/2uyHHGqFYGg/hqdefault.jpg',
        qs: [
          { text: 'How many parts of speech are there in English?', options: ['8', '6', '10', '12'] },
          { text: 'In "She runs fast", what is the subject?', options: ['She', 'runs', 'fast', 'runs fast'] },
          { text: 'The past tense of "go" is:', options: ['went', 'goed', 'gone', 'going'] },
        ],
      },
      {
        title: 'World History Milestones',
        subj: 'History', teacher: 'teacher_english', deadline: d(2026,3,18),
        description: 'Journey through key events from the French Revolution to the World Wars that shaped modern history.',
        fileUrl: 'https://www.youtube.com/embed/5fJl_ZX91l0',
        thumbnailUrl: 'https://img.youtube.com/vi/5fJl_ZX91l0/hqdefault.jpg',
        qs: [
          { text: 'The French Revolution began in which year?', options: ['1789', '1776', '1815', '1799'] },
          { text: 'World War I started in:', options: ['1914', '1918', '1939', '1905'] },
          { text: 'The Magna Carta was signed in:', options: ['1215', '1066', '1415', '1066'] },
        ],
      },
    ],
    '9B': [
      {
        title: 'Computer Fundamentals',
        subj: 'Computer Science', teacher: 'teacher_cs', deadline: d(2026,1,25),
        description: 'Learn the basics of computer hardware, software, binary numbers, and how computers process information.',
        fileUrl: 'https://www.youtube.com/embed/Xpk67YzOn5w',
        thumbnailUrl: 'https://img.youtube.com/vi/Xpk67YzOn5w/hqdefault.jpg',
        qs: [
          { text: 'RAM stands for:', options: ['Random Access Memory', 'Read-only Active Memory', 'Rapid Access Module', 'Recursive Array Memory'] },
          { text: 'Which of the following is an input device?', options: ['Keyboard', 'Monitor', 'Speaker', 'Printer'] },
          { text: 'The binary representation of the decimal number 5 is:', options: ['101', '110', '100', '011'] },
        ],
      },
      {
        title: 'Hindi Vyakaran Parichay',
        subj: 'Hindi', teacher: 'teacher_hindi', deadline: d(2026,3,15),
        description: 'हिन्दी व्याकरण की मूल अवधारणाएँ — संज्ञा, सर्वनाम, क्रिया और वाक्य के प्रकार।',
        fileUrl: 'https://www.youtube.com/embed/vJWW5JNKBMU',
        thumbnailUrl: 'https://img.youtube.com/vi/vJWW5JNKBMU/hqdefault.jpg',
        qs: [
          { text: 'संज्ञा किसे कहते हैं?', options: ['किसी व्यक्ति, वस्तु या स्थान के नाम को', 'क्रिया के बदले हुए रूप को', 'वाक्य में विशेषण को', 'अव्यय शब्द को'] },
          { text: 'क्रिया का एक उदाहरण है:', options: ['चलना', 'मेज़', 'सुंदर', 'वह'] },
          { text: 'वाक्य के कितने प्रकार होते हैं?', options: ['तीन', 'दो', 'चार', 'पाँच'] },
        ],
      },
    ],
  };

  const materialsByClass = {};
  for (const [clsKey, mats] of Object.entries(materialConfig)) {
    materialsByClass[clsKey] = [];
    for (const mc of mats) {
      const mat = await prisma.studymaterial.create({
        data: {
          title: mc.title,
          description: mc.description,
          type: 'VIDEO',
          fileUrl: mc.fileUrl,
          thumbnailUrl: mc.thumbnailUrl,
          teacherId: teachers[mc.teacher].id,
          classId: classes[clsKey].id,
          subjectId: subjects[mc.subj].id,
          deadline: mc.deadline,
        },
      });
      const qs = await prisma.quizset.create({ data: { studyMaterialId: mat.id, timestamp: 300 } });
      const questions = [];
      for (const qDef of mc.qs) {
        const q = await prisma.question.create({
          data: { quizSetId: qs.id, type: 'MCQ', text: qDef.text, options: qDef.options },
        });
        questions.push({ ...q, correctAnswer: qDef.options[0] }); // correct = first option
      }
      materialsByClass[clsKey].push({ material: mat, questions });
    }
  }
  console.log('\nStudy materials + quizzes (8 materials, 3 questions each) created ✅');

  // ── ASSIGNMENTS ─────────────────────────────────────────────────────────────
  //  PAST assignments (Jan–Mar 2026): all students have graded submissions.
  //  FUTURE assignments (Apr–Jun 2026): no submissions yet → shows as "pending".
  const assignmentConfig = {
    '10A': [
      // Past (graded)
      { title: 'Algebra Practice Set 1',      subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,1,20), past: true },
      { title: 'Science Chapter 3 Questions', subj: 'Science',          teacher: 'teacher_science', due: d(2026,2,5),  past: true },
      { title: 'Essay: My Goals',             subj: 'English',          teacher: 'teacher_english', due: d(2026,2,20), past: true },
      { title: 'Algebra Practice Set 2',      subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,3,5),  past: true },
      { title: 'Computer Networks Basics',    subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,3,22), past: true },
      // Future (pending — no submissions)
      { title: 'Algebraic Expressions Quiz',  subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,4,20), past: false },
      { title: 'Forces & Motion Project',     subj: 'Science',          teacher: 'teacher_science', due: d(2026,5,10), past: false },
      { title: 'Creative Writing Piece',      subj: 'English',          teacher: 'teacher_english', due: d(2026,6,5),  past: false },
    ],
    '10B': [
      { title: 'Quadratic Equations HW',      subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,1,22), past: true },
      { title: 'Lab Report: Acids & Bases',   subj: 'Science',          teacher: 'teacher_science', due: d(2026,2,8),  past: true },
      { title: 'Reading Comprehension',       subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,2,22), past: true },
      { title: 'Statistics Practice',         subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,3,8),  past: true },
      { title: 'HTML & CSS Project',          subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,3,25), past: true },
      { title: 'Polynomial Functions HW',     subj: 'Mathematics',     teacher: 'teacher_math',    due: d(2026,4,22), past: false },
      { title: 'Periodic Table Research',     subj: 'Science',          teacher: 'teacher_science', due: d(2026,5,15), past: false },
      { title: 'Web Page Design',             subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,6,10), past: false },
    ],
    '9A': [
      { title: 'Grammar Exercises 1',         subj: 'English',          teacher: 'teacher_english', due: d(2026,1,18), past: true },
      { title: 'History Timeline Activity',   subj: 'History',          teacher: 'teacher_english', due: d(2026,2,3),  past: true },
      { title: 'Hindi Nibandh',               subj: 'Hindi',            teacher: 'teacher_hindi',   due: d(2026,2,18), past: true },
      { title: 'Grammar Exercises 2',         subj: 'English',          teacher: 'teacher_english', due: d(2026,3,3),  past: true },
      { title: 'Computer Applications',       subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,3,20), past: true },
      { title: 'Short Story Writing',         subj: 'English',          teacher: 'teacher_english', due: d(2026,4,18), past: false },
      { title: 'World War II Research',       subj: 'History',          teacher: 'teacher_english', due: d(2026,5,8),  past: false },
      { title: 'Hindi Kavita Rachna',         subj: 'Hindi',            teacher: 'teacher_hindi',   due: d(2026,6,3),  past: false },
    ],
    '9B': [
      { title: 'Computer Basics Worksheet',   subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,1,24), past: true },
      { title: 'Hindi Poem Analysis',         subj: 'Hindi',            teacher: 'teacher_hindi',   due: d(2026,2,7),  past: true },
      { title: 'Programming Intro',           subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,2,24), past: true },
      { title: 'Hindi Grammar Test',          subj: 'Hindi',            teacher: 'teacher_hindi',   due: d(2026,3,10), past: true },
      { title: 'Spreadsheet Project',         subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,3,28), past: true },
      { title: 'Database Concepts',           subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,4,25), past: false },
      { title: 'Hindi Patra Lekhan',          subj: 'Hindi',            teacher: 'teacher_hindi',   due: d(2026,5,12), past: false },
      { title: 'Algorithm Design',            subj: 'Computer Science', teacher: 'teacher_cs',      due: d(2026,6,8),  past: false },
    ],
  };

  // Split into past (gets submissions) and future (stays pending) — track separately
  const assignmentsByClass = {};    // past assignments only, for submission loop
  for (const [clsKey, asgns] of Object.entries(assignmentConfig)) {
    assignmentsByClass[clsKey] = [];
    for (const a of asgns) {
      const rec = await prisma.assignment.create({
        data: {
          title: a.title,
          description: `${a.subj} assignment: ${a.title}. Submit your completed work before the due date.`,
          classId: classes[clsKey].id,
          subjectId: subjects[a.subj].id,
          teacherId: teachers[a.teacher].id,
          dueDate: a.due,
          submissionType: 'BOTH',
        },
      });
      if (a.past) {
        assignmentsByClass[clsKey].push({ rec, teacherKey: a.teacher, dueDate: a.due });
      }
    }
  }
  console.log('Assignments (8 per class × 4 classes = 32; 5 past + 3 future each) created ✅');

  // ── SUBMISSIONS ───────────────────────────────────────────────────────────
  //  submittedAt is set relative to dueDate so analytics effort scoring works:
  //    STAR / RISING / CONSISTENT  → negative offset = on-time
  //    NEEDS_SUPPORT               → positive offset = late, indices 1+3 = missed
  for (const s of studentDefs) {
    const { cls, profile } = s;
    const { gradeRange, submitOffset } = PROFILES[profile];
    const classAssignments = assignmentsByClass[cls] || [];

    for (let i = 0; i < classAssignments.length; i++) {
      const { rec, teacherKey, dueDate } = classAssignments[i];

      // NEEDS_SUPPORT misses assignments at index 1 and 3
      if (profile === 'NEEDS_SUPPORT' && (i === 1 || i === 3)) continue;

      const submittedAt = new Date(dueDate.getTime() + submitOffset * 86400000);
      const grade = Math.floor(Math.random() * (gradeRange[1] - gradeRange[0] + 1)) + gradeRange[0];

      await prisma.submission.create({
        data: {
          assignmentId: rec.id,
          studentId: students[s.username].id,
          submittedAt,
          grade,
          gradedById: teachers[teacherKey].id,
          feedback: 'Reviewed.',
        },
      });
    }
  }
  console.log('Submissions created ✅');

  // ── ATTENDANCE (previous & current month weekdays — dynamic based on today's date) ──
  //  Generates attendance for ALL weekdays from the 1st of previous month up to today.
  const attendanceDays = [];
  const currentDate = new Date();
  const startMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const cursor = new Date(startMonthDate);
  while (cursor <= today) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) attendanceDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }


  for (const s of studentDefs) {
    const { cls, profile } = s;
    const tKey = classTeacher[cls];
    const rate = PROFILES[profile].attendance;
    for (const date of attendanceDays) {
      const rand = Math.random();
      const status = rand < rate ? 'P' : (rand < rate + 0.05 ? 'L' : 'A');
      await prisma.attendance.create({
        data: {
          date, status,
          studentId: students[s.username].id,
          classId: classes[cls].id,
          teacherId: teachers[tKey].id,
          updatedAt: date,
        },
      });
    }
  }
  console.log(`Attendance created ✅ (${attendanceDays.length} weekdays, ${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })})`);

  // ── EXAM MARKS (1st Terminal) ─────────────────────────────────────────────
  for (const s of studentDefs) {
    const { cls, profile } = s;
    const enteredBy = teachers[classTeacher[cls]].id;
    const examMarks = PROFILES[profile].examMarks;
    const clsSubjs  = classSubjects[cls];

    for (let i = 0; i < clsSubjs.length; i++) {
      const m = examMarks[i % examMarks.length];
      await prisma.exammark.create({
        data: {
          studentId:          students[s.username].id,
          subjectId:          subjects[clsSubjs[i]].id,
          examTerminal:       '1st Term',
          marks:              m,
          passMarks:          35,
          fullMarks:          100,
          theoryMarks:        Math.round(m * 0.75),
          theoryFullMarks:    75,
          theoryPassMarks:    27,
          practicalMarks:     Math.round(m * 0.25),
          practicalFullMarks: 25,
          practicalPassMarks: 8,
          totalFullMarks:     100,
          totalPassMarks:     35,
          status:             m >= 35 ? 'PASSED' : 'FAILED',
          enteredById:        enteredBy,
        },
      });
    }
  }
  console.log('Exam marks created ✅');

  // ── EXAM SUBMISSIONS + PUBLICATION (make analytics work) ─────────────────
  // Clean ALL old submission/publish records
  await prisma.classexamsubmission.deleteMany({});
  await prisma.subjectexamsubmission.deleteMany({});
  await prisma.schoolexampublish.deleteMany({});

  for (const clsKey of Object.keys(classes)) {
    const cls = classes[clsKey];
    const tKey = classTeacher[clsKey];
    const tId = tKey ? teachers[tKey]?.id : null;

    await prisma.classexamsubmission.create({
      data: { classId: cls.id, examTerminal: '1st Term', status: 'SUBMITTED', teacherId: tId }
    });

    for (const subName of (classSubjects[clsKey] || [])) {
      if (!subjects[subName]) continue;
      await prisma.subjectexamsubmission.create({
        data: { classId: cls.id, subjectId: subjects[subName].id, examTerminal: '1st Term', status: 'SUBMITTED', teacherId: tId }
      });
    }
  }

  // NOTE: schoolexampublish NOT created — admin must Publish + Run Calculation manually
  // This lets you test the full session flow: Publish → Calculate → Verify → End Session
  console.log('Exam submissions created ✅ (publish + calculation left for admin to do)');

  // ── MATERIAL STATUS + QUIZ RESPONSES ─────────────────────────────────────
  //  STAR and RISING students complete all materials before the deadline
  //  and answer all quiz questions (STAR 90% correct, RISING 85%).
  //  CONSISTENT and NEEDS_SUPPORT leave materials untouched.
  for (const s of studentDefs) {
    const { cls, profile } = s;
    const { doMaterials, quizRate } = PROFILES[profile];
    const clsMaterials = materialsByClass[cls] || [];

    if (!doMaterials) {
      // CONSISTENT students have watched the video (DONE) but haven't answered quiz yet
      if (profile === 'CONSISTENT') {
        for (const { material } of clsMaterials) {
          await prisma.studentmaterialstatus.create({
            data: {
              studentId:       students[s.username].id,
              studyMaterialId: material.id,
              status:          'DONE',
              lastPosition:    590,
              totalDuration:   600,
            },
          });
        }
      }
      continue;
    }

    for (const { material, questions } of clsMaterials) {
      const completedAt = new Date(material.deadline.getTime() - 5 * 86400000); // 5 days before
      await prisma.studentmaterialstatus.create({
        data: {
          studentId:       students[s.username].id,
          studyMaterialId: material.id,
          status:          'DONE',
          completedAt,
          lastPosition:    580,
          totalDuration:   600,
        },
      });
      for (const q of questions) {
        const isCorrect = Math.random() < quizRate;
        // correctAnswer stored on question object (index 0), wrong = index 1
        const answer = isCorrect ? (q.correctAnswer || q.options?.[0] || 'A') : (q.options?.[1] || 'B');
        await prisma.quizresponse.create({
          data: {
            studentId: students[s.username].id,
            questionId: q.id,
            answer,
            isCorrect,
            feedback:  isCorrect ? 'Correct!' : 'Review the material again.',
          },
        });
      }
    }
  }
  console.log('Material statuses + quiz responses created ✅');

  // NOTE: potentialmetric NOT created — admin must Run Calculation first, then teacher verifies
  // This lets you test: Run Calculation → creates PENDING_TEACHER_REVIEW → teacher fills MCQ → COMPLETED
  console.log('Potential metrics skipped (created by Run Calculation) ✅');

  // ── RATINGS ───────────────────────────────────────────────────────────────
  const profileRatingBase = { STAR: 4.5, RISING: 3.8, CONSISTENT: 4.2, NEEDS_SUPPORT: 3.0 };

  for (const s of studentDefs) {
    const tKey = classTeacher[s.cls];
    const base = profileRatingBase[s.profile];
    await prisma.rating.create({
      data: {
        teacherId:   teachers[tKey].id,
        studentId:   students[s.username].id,
        subjectId:   subjects[classRatingSubject[s.cls]].id,
        classId:     classes[s.cls].id,
        score:       Math.round((base + (Math.random() * 0.4 - 0.2)) * 10) / 10,
        review:      'Assessed based on classroom performance and engagement.',
        session:     '1st Session',
        sessionYear: 2026,
      },
    });
  }
  console.log('Ratings created ✅');

  // ── SWOT FEEDBACK ─────────────────────────────────────────────────────────
  const swotByProfile = {
    STAR: {
      strength:    'Consistent high performance with strong analytical thinking',
      weakness:    'Can engage more actively in group activities',
      opportunity: 'Excellent candidate for academic competitions and leadership',
      threat:      'Risk of complacency; challenge needed to stay motivated',
    },
    RISING: {
      strength:    'Highly motivated, completes all study materials and quizzes',
      weakness:    'Exam results do not yet reflect true effort and potential',
      opportunity: 'With targeted exam preparation, academic marks will improve',
      threat:      'Low confidence and exam anxiety are holding back performance',
    },
    CONSISTENT: {
      strength:    'Reliable student with good marks and timely submissions',
      weakness:    'Does not explore beyond prescribed curriculum',
      opportunity: 'Can become a class mentor and deepen conceptual understanding',
      threat:      'May plateau without additional intellectual challenge',
    },
    NEEDS_SUPPORT: {
      strength:    'Shows curiosity and understanding in one-on-one interactions',
      weakness:    'Irregular attendance and frequent missed assignments',
      opportunity: 'Structured support and parental involvement can turn it around',
      threat:      'Risk of falling significantly behind without intervention',
    },
  };

  for (const s of studentDefs) {
    const tKey = classTeacher[s.cls];
    const swot = swotByProfile[s.profile];
    await prisma.feedback.create({
      data: {
        teacherId:   teachers[tKey].id,
        studentId:   students[s.username].id,
        strength:    swot.strength,
        weakness:    swot.weakness,
        opportunity: swot.opportunity,
        threat:      swot.threat,
        suggestion:  'Please discuss these points with the student and set clear improvement goals.',
      },
    });
  }
  console.log('SWOT Feedback created ✅');

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { message: 'Welcome to School Space Academy! The 1st Terminal exams have been scheduled.', type: 'INFO',    schoolId, adminId: adminUser.id },
      { message: 'January attendance records have been updated. Please verify.',                  type: 'INFO',    schoolId, teacherId: teachers['teacher_math'].id },
      { message: 'Reminder: Exam fee of ₹1500 is due by 30 April 2026.',                         type: 'WARNING', schoolId, adminId: adminUser.id },
      { message: 'New study materials have been uploaded for 10A Mathematics.',                   type: 'INFO',    schoolId, teacherId: teachers['teacher_math'].id },
      { message: 'Study materials uploaded for 9B Computer Science.',                             type: 'INFO',    schoolId, teacherId: teachers['teacher_cs'].id },
    ],
  });
  for (const [, sRec] of Object.entries(students)) {
    await prisma.notification.create({
      data: { message: '1st Terminal exam marks have been published. Check your report.', type: 'INFO', schoolId, studentId: sRec.id },
    });
  }
  console.log('Notifications created ✅');

  // ── TEACHER MESSAGES ──────────────────────────────────────────────────────
  const teacherFullNames = {
    teacher_math: 'Amit Verma', teacher_science: 'Sunita Rao',
    teacher_english: 'Vikram Nair', teacher_cs: 'Neha Gupta', teacher_hindi: 'Rajan Mehta',
  };

  for (const [pKey, pRec] of Object.entries(parents)) {
    const pDef  = parentDefs.find(p => p.username === pKey);
    const child = pDef.children[0];
    const sDef  = studentDefs.find(s => s.username === child);
    const tKey  = classTeacher[sDef.cls];
    await prisma.teachermessage.create({
      data: {
        teacherId: teachers[tKey].id,
        parentId:  pRec.id,
        studentId: students[child].id,
        subject:   '1st Session Academic Progress Report',
        body:      `Dear Parent,\n\nThis is to update you on ${sDef.firstName}'s performance during the 1st Session 2026. Please log in to School Space to review the detailed analytics and exam marks.\n\nFeel free to reach out if you have any concerns.\n\nRegards,\n${teacherFullNames[tKey]}`,
      },
    });
  }
  console.log('Teacher messages created ✅');

  // ── FEEDBACK REQUESTS ─────────────────────────────────────────────────────
  for (const [pKey, pRec] of Object.entries(parents)) {
    const pDef  = parentDefs.find(p => p.username === pKey);
    const child = pDef.children[0];
    const sDef  = studentDefs.find(s => s.username === child);
    const tKey  = classTeacher[sDef.cls];
    await prisma.feedbackrequest.create({
      data: {
        parentId:   pRec.id,
        studentId:  students[child].id,
        teacherId:  teachers[tKey].id,
        preference: 'TEACHER',
        status:     'PENDING',
      },
    });
  }
  console.log('Feedback requests created ✅');

  // ── FEES ──────────────────────────────────────────────────────────────────
  for (const [, sRec] of Object.entries(students)) {
    await prisma.fee.createMany({
      data: [
        { studentId: sRec.id, amount: 5000, type: 'TUITION', status: 'PAID',    dueDate: new Date('2026-03-31') },
        { studentId: sRec.id, amount: 1500, type: 'EXAM',    status: 'PENDING', dueDate: new Date('2026-04-30') },
      ],
    });
  }
  console.log('Fees created ✅');

  // ── PENDING TEACHERS (Faculty approval badge) ─────────────────────────────
  //  2 teachers who have signed up but not yet been approved by the admin.
  //  This makes the amber badge appear on the Faculty sidebar item.
  const pendingTeacherDefs = [
    { username: 'teacher_pending1', firstName: 'Pooja',  lastName: 'Desai', email: 'pooja.desai@schoolspace.demo',  subject: 'Physics' },
    { username: 'teacher_pending2', firstName: 'Sameer', lastName: 'Iyer',  email: 'sameer.iyer@schoolspace.demo',  subject: 'Geography' },
  ];
  for (const t of pendingTeacherDefs) {
    const uRec = await prisma.user.create({
      data: {
        username: t.username, password: await hash(PW),
        firstName: t.firstName, lastName: t.lastName,
        email: t.email, role: 'TEACHER',
        emailVerified: true, isActive: false, schoolId,
      },
    });
    await prisma.teacher.create({
      data: { userId: uRec.id, schoolId, status: 'PENDING', isClassTeacher: false, email: t.email },
    });
    await prisma.notification.create({
      data: { message: `New teacher ${t.firstName} ${t.lastName} has registered and is awaiting approval.`, type: 'INFO', schoolId, adminId: adminUser.id },
    });
  }
  console.log('Pending teachers (2) created ✅  → Faculty badge will show "2"');

  // (Exam submissions already created above after exam marks)

  // ── ADMIN INBOX MESSAGES (Messaging System) ────────────────────────────────
  //  3 messages in different states so all inbox states can be tested:
  //    - PENDING  (awaiting admin action)
  //    - ACCEPTED (conversation open — reply also seeded)
  //    - REJECTED
  const msgParents = [
    { pKey: 'parent_sharma', subject: 'Concern about Rahul\'s exam performance', body: 'Dear Admin,\n\nI noticed Rahul\'s marks have dropped compared to last term. Could we schedule a meeting to discuss this with his teachers?\n\nThank you,\nRajesh Sharma', status: 'PENDING'  },
    { pKey: 'parent_kumar',  subject: 'Fee payment confirmation request',        body: 'Hello,\n\nI made the tuition fee payment for Aarav on 28 March but have not received an email confirmation. Could you please verify the payment status?\n\nRegards,\nSuresh Kumar',  status: 'ACCEPTED' },
    { pKey: 'parent_patel',  subject: 'Request for extra classes for Meera',     body: 'Dear Admin,\n\nMeera has been finding Science difficult this session. Is there any arrangement for extra coaching or remedial classes?\n\nBest regards,\nDinesh Patel',           status: 'REJECTED' },
  ];

  for (const mp of msgParents) {
    const pDef    = parentDefs.find(p => p.username === mp.pKey);
    const parentUser = await prisma.user.findUnique({ where: { username: mp.pKey } });

    await prisma.message.create({
      data: {
        fromUserId: parentUser.id,
        toUserId:   adminUser.id,
        subject:    mp.subject,
        body:       mp.body,
        status:     mp.status,
      },
    });

    // For the ACCEPTED message, also seed an admin reply
    if (mp.status === 'ACCEPTED') {
      await prisma.message.create({
        data: {
          fromUserId: adminUser.id,
          toUserId:   parentUser.id,
          subject:    'Re: ' + mp.subject,
          body:       `Dear ${pDef.firstName},\n\nThank you for reaching out. We have verified the payment and it shows as received in our system. An email receipt will be sent within 24 hours.\n\nBest regards,\nSchool Space Admin`,
          status:     'ACCEPTED',
        },
      });
    }
  }
  console.log('Admin inbox messages (3: PENDING / ACCEPTED+reply / REJECTED) created ✅');

  // ── SCHOOL CODE + PASSWORD RESET REQUESTS ─────────────────────────────────
  //  These appear under the recovery approval flows in the admin panel.
  const parentKumarUser  = await prisma.user.findUnique({ where: { username: 'parent_kumar'  } });
  const parentGuptaUser  = await prisma.user.findUnique({ where: { username: 'parent_gupta'  } });
  const teacherHindiUser = await prisma.user.findUnique({ where: { username: 'teacher_hindi' } });

  const now = new Date();
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);

  await prisma.schoolcoderequest.createMany({
    data: [
      { email: parentKumarUser.email,  userId: parentKumarUser.id,  status: 'PENDING', createdAt: now, expiresAt: in30min },
      { email: teacherHindiUser.email, userId: teacherHindiUser.id, status: 'PENDING', createdAt: now, expiresAt: in30min },
    ],
  });

  await prisma.passwordresetrequest.createMany({
    data: [
      { userId: parentGuptaUser.id,  code: generateCode(), status: 'PENDING', isUsed: false, createdAt: now, expiresAt: in30min },
    ],
  });
  console.log('School code & password reset requests created ✅  → Recovery approval tabs have data');

  // ── SESSION COMPLETION (needed for "Run Calculation" to work) ──────────────
  //  Mark that teachers completed session data entry for 1st Session 2026.
  for (const [clsKey, cls] of Object.entries(classes)) {
    const tKey = classTeacher[clsKey];
    await prisma.sessioncompletion.create({
      data: {
        classId:   cls.id,
        teacherId: teachers[tKey].id,
        session:   '1st Session',
        year:      2026,
        schoolId,
      },
    });
  }
  console.log('Session completions created ✅');

  // ── DONE ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Demo seeding completed successfully!\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Summary:');
  console.log('  School   : School Space Academy  (code: SS01)');
  console.log('  Classes  : 10A, 10B, 9A, 9B');
  console.log('  Subjects : Mathematics, Science, English, History, Computer Science, Hindi');
  console.log('  Teachers : 5 active + 2 PENDING approval');
  console.log('  Students : 15 (4 per class, 3 in 9A)');
  console.log('  Parents  : 5');
  console.log('');
  console.log('  Login credentials (all users):');
  console.log('    Password    : Demo@1234');
  console.log('    School Code : SS01');
  console.log('');
  console.log('  Admin      : username=admin_demo');
  console.log('  Teachers   : teacher_math / _science / _english / _cs / _hindi');
  console.log('  Students   : student_rahul / _priya / _dev / _ananya  (10A)');
  console.log('               student_aarav / _meera / _kabir / _ishaan (10B)');
  console.log('               student_arjun / _riya  / _kavya           (9A)');
  console.log('               student_neel  / _sneha / _tanvi / _aryan  (9B)');
  console.log('  Parents    : parent_sharma / _kumar / _patel / _gupta / _singh');
  console.log('');
  console.log('  Admin panel features with live data:');
  console.log('  ✔ Dashboard     — enrollment pie chart, top faculty ratings');
  console.log('  ✔ Faculty       — amber badge shows 2 pending teachers');
  console.log('  ✔ Class Mgmt    — 4 dynamic class cards with subjects + teachers');
  console.log('  ✔ Student Reg   — 15 students, searchable by name/class');
  console.log('  ✔ Fac. Ratings  — all 15 students rated their teachers');
  console.log('  ✔ Terminal Res  — 1st Terminal submissions ready, run calc to test');
  console.log('  ✔ Messaging     — inbox: 1 PENDING, 1 ACCEPTED (+reply), 1 REJECTED');
  console.log('  ✔ Recovery      — 2 school code requests + 1 password reset pending');
  console.log('─────────────────────────────────────────────────────────────');
}

if (require.main === module) {
  main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
} else {
  module.exports = main;
}

