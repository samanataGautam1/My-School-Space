const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const student = await prisma.student.findFirst({
      where: { firstName: { contains: 'Shrasta' } },
      include: {
        exammark: true,
        Renamedclass: true
      }
    });
    console.log(JSON.stringify(student, null, 2));
    
    // Let's also check if 1st Term is published for this school
    if (student) {
        const publish = await prisma.schoolexampublish.findFirst({
            where: { schoolId: student.schoolId, examTerminal: '1st Term' }
        });
        console.log("Publish status:", publish);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
check();
