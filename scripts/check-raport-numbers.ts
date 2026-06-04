import { prisma } from '../src/lib/db';

async function checkRaportNumbers() {
  try {
    console.log('🔍 Memeriksa nomor raport di database...\n');

    // Get all students with their raport numbers from NilaiApprove
    const students = await prisma.student.findMany({
      select: {
        id: true,
        name: true,
        studentNo: true,
        nilaiApproves: {
          where: {
            nomorRaport: {
              not: null,
            },
          },
          select: {
            nomorRaport: true,
          },
          distinct: ['nomorRaport'],
        },
      },
      take: 20, // Ambil 20 siswa pertama untuk testing
    });

    console.log('📊 Data Nomor Raport:\n');
    console.log('No | Student ID | Nama | NIS | Nomor Raport');
    console.log('---|------------|------|-----|-------------');

    students.forEach((student, idx) => {
      const raportNumbers = student.nilaiApproves.map(n => n.nomorRaport).join(', ');
      const raportDisplay = raportNumbers || 'BELUM ADA';
      console.log(`${idx + 1}  | ${student.id.substring(0, 8)}... | ${student.name} | ${student.studentNo} | ${raportDisplay}`);
    });

    // Check for duplicate raport numbers
    console.log('\n🔍 Memeriksa duplikasi nomor raport...\n');
    
    const raportByStudent = await prisma.nilaiApprove.findMany({
      where: {
        nomorRaport: {
          not: null,
        },
      },
      select: {
        nomorRaport: true,
        studentId: true,
        student: {
          select: {
            name: true,
          },
        },
      },
      distinct: ['studentId', 'nomorRaport'],
    });

    // Group by nomorRaport to see which students have the same number
    const raportMap = new Map<string, string[]>();
    raportByStudent.forEach(record => {
      const number = record.nomorRaport!;
      if (!raportMap.has(number)) {
        raportMap.set(number, []);
      }
      raportMap.get(number)!.push(`${record.student.name} (${record.studentId.substring(0, 8)}...)`);
    });

    console.log('Nomor Raport | Jumlah Siswa | Siswa');
    console.log('-------------|--------------|------');
    raportMap.forEach((studentNames, raportNumber) => {
      const isDuplicate = studentNames.length > 1 ? '⚠️ DUPLIKAT' : '✓';
      console.log(`${raportNumber} | ${studentNames.length} | ${studentNames.join(', ')} ${isDuplicate}`);
    });

    console.log('\n✅ Selesai memeriksa data');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRaportNumbers();
