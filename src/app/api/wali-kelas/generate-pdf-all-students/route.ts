/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/lib/db';
import { serverError } from '@/lib/server-log';

export async function POST(request: NextRequest) {
  let browser = null;
  try {
    const data = await request.json();
    const { classId, semester, schoolYear, assessmentType } = data;

    if (!classId) {
      return NextResponse.json(
        { success: false, error: 'Class ID tidak tersedia' },
        { status: 400 }
      );
    }

    // Fetch all students in the class
    const students = await prisma.student.findMany({
      where: { classId },
      orderBy: { studentNo: 'asc' },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada siswa dalam kelas ini' },
        { status: 400 }
      );
    }

    // Fetch class info for display
    const classObj = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        semester: true,
        schoolYear: true,
        level: true,
      },
    });

    if (!classObj) {
      return NextResponse.json(
        { success: false, error: 'Data kelas tidak ditemukan' },
        { status: 400 }
      );
    }

    // Fetch all subjects assigned to this level/jenjang
    let allSubjectsForClass: any[] = [];
    if (classObj.levelId) {
      const levelSubjects = await prisma.subject.findMany({
        where: { levelId: classObj.levelId },
        orderBy: { code: 'asc' },
      });
      
      allSubjectsForClass = levelSubjects.map((s: any) => ({
        id: s.id,
        name: s.name,
        nameArabic: s.nameArabic,
        code: s.code,
      }));
    } else {
      // Fallback: if no level, try to get from class subjects
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId },
        include: { subject: true },
      });

      allSubjectsForClass = classSubjects.map((cs: any) => ({
        id: cs.subject.id,
        name: cs.subject.name,
        nameArabic: cs.subject.nameArabic,
        code: cs.subject.code,
      }));
    }

    // Sort by code if not already sorted
    if (!classObj.levelId) {
      allSubjectsForClass.sort((a: any, b: any) => 
        (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
      );
    }

    // Helper functions (copied from generate-pdf-puppeteer)
    const toArabicNumerals = (num: number | string): string => {
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).split('').map(digit => {
        if (digit >= '0' && digit <= '9') {
          return arabicDigits[parseInt(digit)];
        }
        return digit;
      }).join('');
    };

    const formatDateToArabic = (date: any): string => {
      if (!date) return 'في ٢١ يونيو ٢٠٢٦';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const day = dateObj.getDate();
      const month = dateObj.getMonth();
      const year = dateObj.getFullYear();
      
      const monthsArabic = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      
      const arabicDay = toArabicNumerals(day);
      const arabicYear = toArabicNumerals(year);
      return `في ${arabicDay} ${monthsArabic[month]} ${arabicYear}`;
    };

    const scoreToArabicText = (score: number): string => {
      const onesArabic = ['', 'واحد', 'اثنان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
      const teensArabic = ['عشرة', 'احدى عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
      const tensArabic = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
      
      const int = Math.floor(score);
      const decimal = Math.round((score - int) * 10);
      let result = '';

      if (int === 0) result = 'صفر';
      else if (int < 10) result = onesArabic[int];
      else if (int < 20) result = teensArabic[int - 10];
      else if (int < 100) {
        result = tensArabic[Math.floor(int / 10)];
        if (int % 10 > 0) result = onesArabic[int % 10] + ' و' + result;
      } else if (int === 100) result = 'مئة';

      if (decimal > 0) {
        if (decimal === 5) {
          result += ' و نصف';
        } else {
          result += ' و ' + onesArabic[decimal];
        }
      }
      return result;
    };

    const formatScore = (score: number): string => {
      if (score % 1 === 0) {
        return Math.floor(score).toString();
      }
      return score.toFixed(1);
    };

    // Load images as base64
    const publicPath = join(process.cwd(), 'public');
    let logoBase64 = '';
    let ttdBase64 = '';

    try {
      const imagePath = join(publicPath, 'namapondok.png');
      const imageBuffer = readFileSync(imagePath);
      logoBase64 = imageBuffer.toString('base64');
    } catch {
    }

    try {
      const ttdImagePath = join(publicPath, 'ttd.png');
      const ttdImageBuffer = readFileSync(ttdImagePath);
      ttdBase64 = ttdImageBuffer.toString('base64');
    } catch {
    }

    // Generate HTML with all students
    let allStudentsHTML = '';

    for (const student of students) {
      // Fetch NilaiApprove data for this student
      const nilaiApproves = await prisma.nilaiApprove.findMany({
        where: {
          studentId: student.id,
          classId: classId,
          ...(assessmentType && { assessmentType }),
        },
        include: {
          subject: true,
        },
      });

      // Get mulahazoh, nomorRaport, suluk, muazobah, nazofah from first approved grade
      let mulahazoh = '';
      let nomorRaport = '';
      let suluk = '';
      let muazobah = '';
      let nazofah = '';
      
      if (nilaiApproves.length > 0) {
        const firstGrade = nilaiApproves[0];
        if (firstGrade.mulahazoh) mulahazoh = firstGrade.mulahazoh;
        if (firstGrade.nomorRaport) nomorRaport = firstGrade.nomorRaport;
        
        // Get suluk, muazobah, nazofah from specific subject codes
        nilaiApproves.forEach((nilai: any) => {
          const subjectCode = nilai.subject?.code || '';
          if ((subjectCode === 'SLK_A' || subjectCode === 'SLK_B') && nilai.score) {
            suluk = String(nilai.score);
          } else if ((subjectCode === 'MWZ_A' || subjectCode === 'MWZ_B') && nilai.score) {
            muazobah = String(nilai.score);
          } else if ((subjectCode === 'NZF_A' || subjectCode === 'NZF_B') && nilai.score) {
            nazofah = String(nilai.score);
          }
        });
      }

      // Build subject scores from NilaiApprove
      const nilaiMap = new Map();
      nilaiApproves.forEach((nilai) => {
        nilaiMap.set(nilai.subjectId, nilai);
      });

      // Build scores for ALL subjects (showing dashes for those without approval)
      const subjectScores: any[] = allSubjectsForClass.map((subject: any) => {
        const nilai = nilaiMap.get(subject.id);
        
        if (nilai) {
          const averageScore = nilai.averageSubject ? parseFloat(String(nilai.averageSubject)) : 0;
          const rawScore = nilai.score ? parseFloat(nilai.score) : 0;
          
          return {
            subject: subject.name,
            subjectCode: subject.code,
            subjectArabicName: subject.nameArabic || subject.name,
            averageScore,
            rawScore,
            hasApproval: true,
          };
        } else {
          return {
            subject: subject.name,
            subjectCode: subject.code,
            subjectArabicName: subject.nameArabic || subject.name,
            averageScore: 0,
            rawScore: 0,
            hasApproval: false,
          };
        }
      });

      // Filter out excluded subject codes
      const excludedSubjectCodes = ['MWZ_A', 'NZF_A', 'SLK_A', 'MWZ_B', 'NZF_B', 'SLK_B'];
      const filteredSubjectScores = subjectScores.filter((s: any) => !excludedSubjectCodes.includes(s.subjectCode));

      // Build subjects table HTML
      const rightColumn = filteredSubjectScores.slice(0, Math.ceil(filteredSubjectScores.length / 2));
      const leftColumn = filteredSubjectScores.slice(Math.ceil(filteredSubjectScores.length / 2));
      const maxRows = Math.max(rightColumn.length, leftColumn.length);

      let subjectsHTML = '';
      for (let i = 0; i < maxRows; i++) {
        const rightSubject = rightColumn[i];
        const leftSubject = leftColumn[i];

        subjectsHTML += '<tr>';
        // Right side
        if (rightSubject) {
          const subjectName = rightSubject.subjectArabicName || rightSubject.subject;
          subjectsHTML += `<td style="text-align: right; white-space: nowrap; padding: 8px;">${subjectName}</td>`;
          
          if (rightSubject.hasApproval) {
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(rightSubject.averageScore.toFixed(1))}</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(formatScore(rightSubject.rawScore))}</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${scoreToArabicText(rightSubject.rawScore)}</strong></td>`;
          } else {
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
          }
        } else {
          subjectsHTML += '<td></td><td></td><td></td><td></td>';
        }

        // Left side
        if (leftSubject) {
          const subjectName = leftSubject.subjectArabicName || leftSubject.subject;
          subjectsHTML += `<td style="text-align: right; white-space: nowrap; padding: 8px;">${subjectName}</td>`;
          
          if (leftSubject.hasApproval) {
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(leftSubject.averageScore.toFixed(1))}</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(formatScore(leftSubject.rawScore))}</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${scoreToArabicText(leftSubject.rawScore)}</strong></td>`;
          } else {
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
            subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>—</strong></td>`;
          }
        } else {
          subjectsHTML += '<td></td><td></td><td></td><td></td>';
        }
        subjectsHTML += '</tr>';
      }

      // Calculate totals
      const approvedScores = filteredSubjectScores.filter(s => s.hasApproval);
      const avgScore = approvedScores.length > 0 
        ? (approvedScores.reduce((sum, s) => sum + s.averageScore, 0) / approvedScores.length).toFixed(1)
        : 0;
      const totalScore = approvedScores.reduce((sum, s) => sum + s.rawScore, 0);
      const averageRawScore = approvedScores.length > 0
        ? (totalScore / approvedScores.length).toFixed(1)
        : 0;

      // Build the page HTML
      allStudentsHTML += `
        <div class="a4-page" style="page-break-before: always;">
          <div class="watermark-bg">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Trademark" />` : ''}
          </div>
          <div class="page-content">
            <h1 style="font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 18px; margin-top: 8px; margin-bottom: 3px; text-align: center; font-weight: bold;">بسم الله الرحمن الرحيم</h1>
            <table class="info-table" style="margin-bottom: 1px; width: 100%; border-collapse: collapse; font-size: 13px;">
              <tbody>
                <tr>
                  <td class="label" style="font-weight: bold; padding: 2px 0; border: none;">الاسم</td>
                  <td style="padding: 2px 0; border: none;">: ${student.name || '-'}</td>
                  <td class="label" style="font-weight: bold; text-align: right; padding: 2px 0; border: none;">رقم دفتر القيد</td>
                  <td style="padding: 2px 0; border: none;">: ${student.studentNo || '-'}</td>
                  <td class="label" style="font-weight: bold; text-align: right; padding: 2px 0; border: none;">الفصل</td>
                  <td style="padding: 2px 0; border: none;">: ${classObj.name || '-'}</td>
                </tr>
              </tbody>
            </table>

            <table style="margin-top: 8px; width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr>
                  <th rowSpan="2" style="width: 14%; padding: 8px; border: 1px solid #000;">المواد</th>
                  <th colSpan="3" style="width: 36%; padding: 8px; border: 1px solid #000;">الدرجة</th>
                  <th rowSpan="2" style="width: 14%; padding: 8px; border: 1px solid #000;">المواد</th>
                  <th colSpan="3" style="width: 36%; padding: 8px; border: 1px solid #000;">الدرجة</th>
                </tr>
                <tr>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">المعدلة للفصل</th>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">الأرقام</th>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">الحروف</th>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">المعدلة للفصل</th>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">الأرقام</th>
                  <th style="width: 12%; padding: 8px; border: 1px solid #000;">الحروف</th>
                </tr>
              </thead>
              <tbody>
                ${subjectsHTML}
              </tbody>
            </table>

            <table style="margin-top: 8px; width: 100%; border-collapse: collapse; font-size: 14px;">
              <tbody>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000;">المجموع الكليّ</th>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;"><strong>${toArabicNumerals(formatScore(totalScore))}</strong></td>
                  <th style="padding: 8px; border: 1px solid #000;">المعدل العام</th>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;"><strong>${toArabicNumerals(averageRawScore)}</strong></td>
                </tr>
              </tbody>
            </table>

            <table style="margin-top: 8px; width: 100%; border-collapse: collapse; font-size: 14px;">
              <tbody>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000;">السلوك</th>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${suluk ? toArabicNumerals(suluk) : '—'}</td>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${suluk ? scoreToArabicText(parseFloat(suluk)) : '—'}</td>
                </tr>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000;">المواظبة</th>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${muazobah ? toArabicNumerals(muazobah) : '—'}</td>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${muazobah ? scoreToArabicText(parseFloat(muazobah)) : '—'}</td>
                </tr>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000;">النظافة</th>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${nazofah ? toArabicNumerals(nazofah) : '—'}</td>
                  <td style="text-align: center; padding: 8px; border: 1px solid #000;">${nazofah ? scoreToArabicText(parseFloat(nazofah)) : '—'}</td>
                </tr>
              </tbody>
            </table>

            <table style="margin-top: 8px; font-size: 11px; width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <th style="padding: 8px; border: 1px solid #000;">تقدير الدرجات: ١–٣ : ضعيف جداً،   ٤–٥ : ضعيف، ٦ : مقبول، ٧ : جيد، ٨ : جيد جداً، ٩–١٠ : ممتاز </th>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer-section" style="margin-top: auto;">
            <table style="margin-top: 10px; width: 100%; border-collapse: collapse;">
              <tbody>
                <tr style="height: auto;">
                  <td style="width: 33%; text-align: right; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                    <div style="margin-bottom: 50px; padding-top: 8px;">
                      تقرير بدار السلام لاهات، ${formatDateToArabic(classObj.semester?.endDate)}
                    </div>
                  </td>
                  <td style="width: 34%; text-align: center; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                    <div style="margin-bottom: 8px; font-weight: bold;">
                      مدير المعهد دار السلام لاهات
                    </div>
                    ${ttdBase64 ? `<div style="margin: 5px auto; text-align: center; display: flex; justify-content: center; position: relative; z-index: 10;"><img src="data:image/png;base64,${ttdBase64}" style="width: 200px; height: auto;" /></div>` : ''}
                    <div style="border-top: 1px solid #000; margin-top: 5px; padding-top: 8px;"></div>
                    <div style="margin-top: 8px; font-size: 12px;">
                      الأستاذ محمد رومي أوكتاريوس، LC
                    </div>
                  </td>
                  <td style="width: 33%; text-align: center; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                    <div style="margin-bottom: 8px; font-weight: bold;">
                      الملاحظة
                    </div>
                    <div style="font-size: 14px; margin-bottom: 12px; font-weight: bold;">
                      ${mulahazoh || '-'}
                    </div>
                    <div style="font-size: 10px; margin-top: 40px; padding-top: 8px; border-top: 1px solid #ccc;">
                      ${nomorRaport || '-'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Peserta Didik - PDF Semua</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
                direction: rtl;
                color: black;
                background: white;
            }
            .a4-page {
                width: 215mm;
                height: 330mm;
                background: white;
                padding: 8px 8px;
                font-size: 12px;
                line-height: 1.3;
                direction: rtl;
                position: relative;
                overflow: visible;
                display: flex;
                flex-direction: column;
            }
            .watermark-bg {
                position: absolute;
                top: 35%;
                left: 50%;
                transform: translate(-50%, -50%);
                opacity: 1;
                z-index: 1;
                pointer-events: none;
            }
            .watermark-bg img {
                width: 650px;
                height: auto;
            }
            .page-content {
                position: relative;
                z-index: 10;
            }
            h1 {
                font-size: 18px;
                margin-top: 8px;
                margin-bottom: 3px;
                text-align: center;
                font-weight: bold;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
                margin-top: 3px;
            }
            th, td {
                padding: 5px;
                text-align: center;
                vertical-align: middle;
                border: 1px solid #000;
            }
            .info-table {
                margin-bottom: 1px;
            }
            .info-table td {
                font-size: 13px;
                padding: 2px 0;
                border: none;
            }
            .info-table td.label {
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        ${allStudentsHTML}
    </body>
    </html>
    `;

    // Launch Puppeteer
    let executablePath: string;
    
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      try {
        executablePath = await chromium.executablePath();
      } catch (err) {
        executablePath = puppeteer.executablePath();
      }
    }
    
    const launchArgs = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
    ];

    const launchTimeout = 120000;
    
    const launchOptions = {
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true as const,
      timeout: launchTimeout,
      protocolTimeout: launchTimeout,
      ignoreHTTPSErrors: true,
    };

    browser = await puppeteer.launch(launchOptions).catch((launchErr) => {
      serverError('Puppeteer launch failed in generate-all-pdf:', launchErr);
      throw launchErr;
    });

    const page = await browser.newPage();
    const pageTimeout = launchTimeout;
    page.setDefaultTimeout(pageTimeout);
    page.setDefaultNavigationTimeout(pageTimeout);

    await page.setViewport({
      width: 825,
      height: 1260,
      deviceScaleFactor: 1,
    });

    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: pageTimeout,
    });

    const pdfBuffer = await page.pdf({
      width: '215mm',
      height: '330mm',
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      printBackground: true,
      scale: 1,
    });

    await browser.close();

    const base64 = Buffer.from(pdfBuffer).toString('base64');

    // Generate filename
    const className = classObj?.name?.replace(/\s+/g, '') || 'kelas';
    const semesterMatch = semester?.match(/\d+/);
    const semesterNum = semesterMatch ? `smt${semesterMatch[0]}` : 'smt1';
    const yearMatch = schoolYear?.match(/(\d{2})(\d{2})\/(\d{2})(\d{2})/);
    const yearRange = yearMatch ? `${yearMatch[2]}_${yearMatch[4]}` : '24_25';
    
    const fileName = `Raport_Semua_${className}_${semesterNum}_${yearRange}.pdf`;

    return NextResponse.json({
      success: true,
      pdf: `data:application/pdf;base64,${base64}`,
      fileName: fileName,
    });
  } catch (error) {
    serverError('Error generating all students PDF:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        serverError('Error closing browser:', closeErr);
      }
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Gagal membuat PDF semua siswa',
      },
      { status: 500 }
    );
  }
}
