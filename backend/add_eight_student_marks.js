/**
 * add_eight_student_marks.js
 * Adds 4th Term exam marks for "Eight Student" in Class 7A
 * Theory: 70, Practical: 25
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Find the student by code
  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { studentCode: 'MK120B10' },
        { firstName: 'Eight', lastName: 'Student' }
      ]
    },
    include: {
      Renamedclass: { select: { id: true, name: true, section: true, schoolId: true } }
    }
  });

  if (!student) {
    console.error('Student not found!');
    process.exit(1);
  }

  console.log(`Found student: ${student.firstName} ${student.lastName} (${student.studentCode})`);
  console.log(`Class: ${student.Renamedclass?.name}${student.Renamedclass?.section}, schoolId: ${student.Renamedclass?.schoolId}`);
  console.log(`Student ID: ${student.id}, ClassId: ${student.classId}`);

  // 2. Find subjects for this student's class
  const classSubjects = await prisma.teachersubject.findMany({
    where: { classId: student.classId },
    include: { subject: true, teacher: true },
  });

  // Dedupe subjects
  const seen = new Set();
  const subjects = [];
  for (const ts of classSubjects) {
    if (!seen.has(ts.subjectId)) {
      seen.add(ts.subjectId);
      subjects.push(ts);
    }
  }

  console.log(`\nFound ${subjects.length} subject(s) in class ${student.Renamedclass?.name}${student.Renamedclass?.section}:`);
  subjects.forEach(s => console.log(`  - ${s.subject.name} (ID: ${s.subjectId}), Teacher ID: ${s.teacherId}`));

  if (subjects.length === 0) {
    console.error('No subjects found for this class! Cannot insert marks.');
    process.exit(1);
  }

  // 3. Check if 4th Term publish record exists for this school
  const schoolId = student.Renamedclass?.schoolId;
  const publish = await prisma.schoolexampublish.findFirst({
    where: { schoolId, examTerminal: '4th Term', status: 'PUBLISHED' }
  });
  console.log(`\n4th Term publish record: ${publish ? `FOUND (id=${publish.id})` : 'NOT FOUND'}`);
  if (!publish) {
    console.error('4th Term is not published for this school. Marks will still be inserted but may not show.');
  }

  // 4. Insert 4th Term exam marks for each subject
  const TERM = '4th Term';
  const theoryMarks = 70;
  const theoryFullMarks = 75;
  const theoryPassMarks = 28; // ~40% of 75
  const practicalMarks = 25;
  const practicalFullMarks = 25;
  const practicalPassMarks = 10; // ~40% of 25
  const totalMarks = theoryMarks + practicalMarks; // 95
  const totalFullMarks = theoryFullMarks + practicalFullMarks; // 100
  const totalPassMarks = theoryPassMarks + practicalPassMarks; // 38

  let inserted = 0;
  let skipped = 0;

  for (const ts of subjects) {
    // Check if mark already exists
    const existing = await prisma.exammark.findFirst({
      where: { studentId: student.id, subjectId: ts.subjectId, examTerminal: TERM }
    });

    if (existing) {
      console.log(`  ⚠️  Mark already exists for ${ts.subject.name} (${TERM}) — skipping`);
      skipped++;
      continue;
    }

    await prisma.exammark.create({
      data: {
        studentId: student.id,
        subjectId: ts.subjectId,
        enteredById: ts.teacherId,
        marks: totalMarks,
        passMarks: totalPassMarks,
        fullMarks: totalFullMarks,
        theoryMarks,
        theoryFullMarks,
        theoryPassMarks,
        practicalMarks,
        practicalFullMarks,
        practicalPassMarks,
        totalFullMarks,
        totalPassMarks,
        examTerminal: TERM,
        status: 'PASSED'
      }
    });

    console.log(`  ✓ Inserted 4th Term mark for ${ts.subject.name}: Theory ${theoryMarks}/${theoryFullMarks} + Practical ${practicalMarks}/${practicalFullMarks} = ${totalMarks}/${totalFullMarks} → PASSED`);
    inserted++;
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped (already existed): ${skipped}`);
  console.log(`Expected % in promotions tab: ${((totalMarks / totalFullMarks) * 100).toFixed(1)}%`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
