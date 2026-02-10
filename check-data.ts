import { prisma } from '@/lib/db';

async function main() {
  // Check student
  const studentId = 'cmlfy8aqr000eowv8f0pk8ztt';
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });
  
  console.log('=== STUDENT ===');
  console.log(student);

  // Check grades for this student
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: {
      competency: {
        include: { subject: true },
      },
      teacher: true,
    },
  });

  console.log('\n=== GRADES ===');
  console.log(`Total: ${grades.length}`);
  grades.forEach(g => {
    console.log(`- ${g.competency?.subject?.name}: ${g.score} (${g.assessmentType})`);
  });

  // Check attendance for this student
  const attendance = await prisma.attendance.findMany({
    where: { studentId },
  });

  console.log('\n=== ATTENDANCE ===');
  console.log(`Total records: ${attendance.length}`);

  process.exit(0);
}

main().catch(console.error);
