import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';

export async function POST(request: NextRequest) {
  let browser = null;
  try {
    const data = await request.json();
    const { studentName, className, studentNo, raportNo } = data;

    if (!studentName || !className) {
      return NextResponse.json(
        { success: false, error: 'Data siswa atau kelas tidak lengkap' },
        { status: 400 }
      );
    }

    // Generate simple cover HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sampul Raport</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
            direction: rtl;
            color: #333;
            background: white;
          }
          .cover-page {
            width: 215mm;
            height: 330mm;
            background: white;
            font-size: 11px;
            line-height: 1.2;
            direction: rtl;
            position: relative;
            overflow: hidden;
            padding: 20mm 15mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .cover-header {
            text-align: center;
            margin-bottom: 40px;
          }
          .school-name {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 15px;
            line-height: 1.4;
          }
          .title-section {
            text-align: center;
            margin-bottom: 60px;
          }
          .title-main {
            font-size: 32px;
            font-weight: bold;
            color: #006b4d;
            margin-bottom: 20px;
            text-decoration: underline;
          }
          .title-sub {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 30px;
          }
          .student-info {
            text-align: center;
            margin-bottom: 40px;
            line-height: 2;
          }
          .info-label {
            font-weight: 600;
            color: #555;
            margin-bottom: 10px;
          }
          .info-value {
            font-size: 16px;
            color: #1a1a1a;
            margin-bottom: 20px;
            font-weight: 500;
          }
          .footer-section {
            text-align: center;
            margin-top: auto;
            padding-bottom: 40px;
          }
          .footer-text {
            font-size: 12px;
            color: #666;
            font-style: italic;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .cover-page {
              width: 100%;
              height: 100vh;
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <div class="cover-header">
            <div class="school-name">المدرسة الإسلامية</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Islamic School</div>
          </div>

          <div class="title-section">
            <div class="title-main">التقرير الدراسي</div>
            <div class="title-sub">Raport Semester</div>
          </div>

          <div class="student-info">
            <div class="info-label">اسم الطالب / Student Name</div>
            <div class="info-value">${studentName}</div>

            <div class="info-label">رقم الطالب / Student Number</div>
            <div class="info-value">${studentNo || '-'}</div>

            <div class="info-label">الفصل / Class</div>
            <div class="info-value">${className}</div>

            ${raportNo ? `
              <div class="info-label">رقم التقرير / Raport Number</div>
              <div class="info-value">${raportNo}</div>
            ` : ''}
          </div>

          <div class="footer-section">
            <div class="footer-text">Tahun Akademik 2025/2026</div>
            <div class="footer-text">Academic Year 2025/2026</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Setup Puppeteer with Chromium
    let executablePath = '';

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      executablePath = await chromium.executablePath();
    }

    const launchArgs = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ];

    console.log('Launching browser for cover PDF with executable:', executablePath);
    
    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // Set viewport to match F4 size
    await page.setViewport({
      width: Math.round(215 * 96 / 25.4), // 215mm to pixels (96 DPI)
      height: Math.round(330 * 96 / 25.4), // 330mm to pixels
      deviceScaleFactor: 1,
    });

    // Set content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
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

    // Convert to base64
    const base64 = Buffer.from(pdfBuffer).toString('base64');

    // Generate filename
    const cleanStudentName = studentName?.replace(/\s+/g, '_') || 'student';
    const cleanClassName = className?.replace(/\s+/g, '') || 'unknown';
    const fileName = `Sampul_${cleanStudentName}_${cleanClassName}.pdf`;

    return NextResponse.json({
      success: true,
      pdf: `data:application/pdf;base64,${base64}`,
      fileName: fileName,
    });
  } catch (error) {
    console.error('Error generating cover PDF:', {
      error: String(error),
      errorMsg: error instanceof Error ? error.message : 'Unknown error',
    });

    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Error closing browser:', closeErr);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        debug: process.env.NODE_ENV === 'development' ? {
          errorMsg: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
