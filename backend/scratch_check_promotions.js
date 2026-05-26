const prisma = require('./prisma/prisma');

async function verifyPromotions() {
  try {
    // 1. Get the first school in the system to verify against
    const school = await prisma.school.findFirst({
      select: { id: true, name: true }
    });

    if (!school) {
      console.log('No schools found in the database. Creating one or seeding might be needed.');
      return;
    }

    const schoolId = school.id;
    console.log(`Verifying promotions logic for school: "${school.name}" (ID: ${schoolId})\n`);

    // 2. Get latest published terminal
    const latestPublish = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    });

    console.log(`Latest published terminal: ${latestPublish ? latestPublish.examTerminal : 'None'}`);

    // 3. Get 4th terminal publish specifically
    const fourthTermPublishRecord = await prisma.schoolexampublish.findFirst({
      where: { schoolId, status: 'PUBLISHED', examTerminal: { contains: '4th' } }
    });

    console.log(`4th terminal publish record: ${fourthTermPublishRecord ? fourthTermPublishRecord.examTerminal : 'None'}`);

    // 4. Fetch students
    const students = await prisma.student.findMany({
      where: { schoolId },
      include: {
        Renamedclass: { select: { id: true, name: true, section: true } }
      }
    });

    console.log(`Total students fetched: ${students.length}\n`);

    // 5. Fetch exam marks
    let examMarks = [];
    if (latestPublish) {
      examMarks = await prisma.exammark.findMany({
        where: {
          student: { schoolId },
          examTerminal: latestPublish.examTerminal
        }
      });
    }

    let class10ExamMarks = [];
    if (fourthTermPublishRecord) {
      class10ExamMarks = await prisma.exammark.findMany({
        where: {
          student: { schoolId },
          examTerminal: fourthTermPublishRecord.examTerminal
        }
      });
    }

    // 6. Build maps
    const marksMap = {};
    for (const mark of examMarks) {
      if (!marksMap[mark.studentId]) {
        marksMap[mark.studentId] = { totalObtained: 0, totalFull: 0, isFail: false, subjectCount: 0 };
      }
      marksMap[mark.studentId].totalObtained += mark.marks || 0;
      marksMap[mark.studentId].totalFull += mark.fullMarks || 100;
      marksMap[mark.studentId].subjectCount++;
      if (['FAIL','FAILED'].includes(mark.status)) marksMap[mark.studentId].isFail = true;
    }

    const class10MarksMap = {};
    for (const mark of class10ExamMarks) {
      if (!class10MarksMap[mark.studentId]) {
        class10MarksMap[mark.studentId] = { totalObtained: 0, totalFull: 0, isFail: false, subjectCount: 0 };
      }
      class10MarksMap[mark.studentId].totalObtained += mark.marks || 0;
      class10MarksMap[mark.studentId].totalFull += mark.fullMarks || 100;
      class10MarksMap[mark.studentId].subjectCount++;
      if (['FAIL','FAILED'].includes(mark.status)) class10MarksMap[mark.studentId].isFail = true;
    }

    const FINAL_CLASS_LEVEL = 10;

    // 7. Verify some sample students from both Class 10 and Class 1-9
    const mappedStudents = students.map(s => {
      const level = s.Renamedclass ? parseInt(s.Renamedclass.name) : NaN;
      const isClass10OrAbove = !isNaN(level) && level >= FINAL_CLASS_LEVEL;

      const marks = isClass10OrAbove ? class10MarksMap[s.id] : marksMap[s.id];
      const percentage = marks && marks.totalFull > 0
        ? ((marks.totalObtained / marks.totalFull) * 100).toFixed(1)
        : null;
      const resultStatus = percentage !== null ? (percentage >= 50 ? 'PASS' : 'FAIL') : null;

      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        class: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section}` : 'N/A',
        isClass10OrAbove,
        percentage,
        resultStatus,
        subjectCount: marks?.subjectCount || 0
      };
    });

    const class10s = mappedStudents.filter(s => s.isClass10OrAbove);
    const class1to9s = mappedStudents.filter(s => !s.isClass10OrAbove);

    console.log('--- CLASS 10 STUDENTS (GRADUATION) ---');
    if (class10s.length === 0) {
      console.log('No Class 10 students found.');
    } else {
      class10s.slice(0, 5).forEach(s => {
        console.log(`Student: ${s.name} (${s.class}) -> %: ${s.percentage}% | Status: ${s.resultStatus} | Terminal Marks From: 4th Term specifically`);
      });
    }

    console.log('\n--- CLASS 1-9 STUDENTS (PROMOTION) ---');
    if (class1to9s.length === 0) {
      console.log('No Class 1-9 students found.');
    } else {
      class1to9s.slice(0, 5).forEach(s => {
        console.log(`Student: ${s.name} (${s.class}) -> %: ${s.percentage}% | Status: ${s.resultStatus} | Terminal Marks From: Latest Published (${latestPublish ? latestPublish.examTerminal : 'None'})`);
      });
    }

    console.log('\nVerification complete!');
  } catch (error) {
    console.error('Error verifying promotions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPromotions();
