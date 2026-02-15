import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/raport_db";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDatabase() {
  try {
    console.log("\n=== Checking NilaiApprove for student ===\n");
    
    const data = await prisma.nilaiApprove.findMany({
      where: {
        studentId: "cmlnjyihv0035owv80dso8m56",
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            nameArabic: true
          }
        }
      },
      orderBy: { subject: { code: 'asc' } }
    });

    console.log(`Total records: ${data.length}\n`);
    
    data.forEach((record, idx) => {
      console.log(`[${idx + 1}] ${record.subject?.name || 'N/A'} (${record.subject?.code || 'N/A'})`);
      console.log(`    averageSubject: ${record.averageSubject}`);
      console.log(`    averageStudent: ${record.averageStudent}`);
      console.log(`    midScore: ${record.midScore}, finalScore: ${record.finalScore}`);
      console.log(`    isApproved: ${record.isApproved}\n`);
    });
    
    // Check specifically for IMLA ARABI
    console.log("\n=== Checking for IMLA ARABI specifically ===\n");
    const imla = await prisma.nilaiApprove.findMany({
      where: {
        studentId: "cmlnjyihv0035owv80dso8m56",
        subject: {
          name: { contains: 'IMLA' }
        }
      },
      include: {
        subject: true
      }
    });
    
    console.log(`IMLA records: ${imla.length}`);
    imla.forEach(record => {
      console.log(JSON.stringify(record, null, 2));
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
