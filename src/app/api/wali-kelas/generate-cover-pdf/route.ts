import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { join } from 'path';
import { serverError } from '@/lib/server-log';

export async function POST(request: NextRequest) {
  let browser = null;
  try {
    const data = await request.json();
    const { studentName, className, studentNo, raportNo, gender, semesterLabel, schoolYear, schoolYearGregorian } = data;


    if (!studentName || !className) {
      return NextResponse.json(
        { success: false, error: 'Data siswa atau kelas tidak lengkap' },
        { status: 400 }
      );
    }

    // Read images as base64
    const publicPath = join(process.cwd(), 'public');
    let bingkaiBase64 = '';
    let kmiBase64 = '';
    let kmiPutriBase64 = '';
    let mahadBase64 = '';
    let kashfuBase64 = '';

    try {
      const bingkaiPath = join(publicPath, 'bingkai.png');
      bingkaiBase64 = readFileSync(bingkaiPath).toString('base64');
    } catch {
    }

    try {
      const kmiPath = join(publicPath, 'KMI.jpg');
      kmiBase64 = readFileSync(kmiPath).toString('base64');
    } catch {
    }

    try {
      const kmiPutriPath = join(publicPath, 'kmi_putri.png');
      kmiPutriBase64 = readFileSync(kmiPutriPath).toString('base64');
    } catch {
    }

    try {
      const mahadPath = join(publicPath, 'mahad.png');
      mahadBase64 = readFileSync(mahadPath).toString('base64');
    } catch {
    }

    try {
      const kashfuPath = join(publicPath, 'kasyfu.jpg');
      kashfuBase64 = readFileSync(kashfuPath).toString('base64');
    } catch {
    }

    // Generate HTML matching the preview page
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sampul Raport</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
            direction: rtl;
            background: white;
          }

          .cover-page {
            width: 215mm;
            height: 330mm;
            background: white;
            font-size: 13px;
            line-height: 1.3;
            direction: rtl;
            position: relative;
            overflow: hidden;
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
          }

          .cover-frame {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 215mm;
            height: 330mm;
            z-index: 0;
            pointer-events: none;
          }

          .cover-frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .cover-content {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 20mm 15mm;
            box-sizing: border-box;
          }

          .cover-logo-section {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 12px;
            margin-bottom: 10mm;
            width: 100%;
          }

          .cover-logo-kmi {
            max-width: 600px;
            height: auto;
            object-fit: contain;
            margin-top: 14mm;
          }

          .cover-logo-kmi-putri {
            max-width: 450px;
            height: auto;
            object-fit: contain;
            margin-top: 14mm;
          }

          .cover-logo-mahad {
            max-width: 380px;
            height: auto;
            object-fit: contain;
          }

          .cover-header-section {
            text-align: center;
            margin-bottom: 6mm;
            padding-bottom: 0;
          }

          .cover-institution-location {
            font-size: 24px;
            color: #1b025b;
            margin-bottom: 0;
            direction: rtl;
            font-weight: 700;
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
          }

          .cover-title-section {
            text-align: center;
            margin: 6mm 0 12mm 0;
          }

          .cover-title-image {
            max-width: 400px;
            height: auto;
            object-fit: contain;
            margin-bottom: 46px;
          }

          .cover-semester-info {
            text-align: center;
            font-size: 18px;
            color: #000000;
            margin-bottom: 15px;
            line-height: 1.3;
            font-weight: 700;
            direction: rtl;
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
          }

          .cover-year-info {
            text-align: center;
            font-size: 16px;
            color: #000000;
            margin-bottom: 16mm;
            line-height: 1.4;
            direction: rtl;
            font-weight: 600;
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
          }

          .cover-student-info {
            background: transparent;
            padding: 0;
            width: 100%;
            font-family: 'Times New Roman', serif;
            margin: 0 auto 8mm auto;
            max-width: 100%;
            border-collapse: collapse;
            direction: ltr;
            display: grid;
            grid-template-columns: auto 50px auto;
            align-items: center;
            justify-items: center;
            gap: 0;
          }

          .cover-info-row {
            display: contents;
          }

          .cover-info-label {
            font-weight: bold;
            text-align: right;
            color: #333;
            font-size: 22px;
            padding: 10px;
            direction: rtl;
            justify-self: end;
            font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Amiri', 'Arabic Typesetting', 'Arial Unicode MS', serif;
          }

          .cover-info-value {
            text-align: right;
            font-weight: bold;
            color: #1a1a1a;
            font-size: 22px;
            padding: 10px;
            justify-self: end;
          }

          .cover-separator {
            text-align: center;
            font-weight: 400;
            color: #333;
            font-size: 22px;
            padding: 10px;
            width: auto;
            flex: 1;
            direction: ltr;
            justify-self: center;
          }

          .cover-serial-section {
            text-align: center;
            margin-top: auto;
            padding-top: 8mm;
          }

          .cover-serial-box {
            border: 2px solid #333;
            display: inline-block;
            padding: 8px 18px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: 600;
            color: #1a1a1a;
            background: #fafafa;
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <!-- Frame Background -->
          <div class="cover-frame">
            ${bingkaiBase64 ? `<img src="data:image/png;base64,${bingkaiBase64}" alt="Frame" />` : ''}
          </div>

          <!-- Cover Content -->
          <div class="cover-content">
            <!-- Logo Section -->
            <div class="cover-logo-section">
              ${gender === 'FEMALE' && kmiPutriBase64 ? `<img src="data:image/png;base64,${kmiPutriBase64}" alt="KMI Logo" class="cover-logo-kmi-putri" />` : kmiBase64 ? `<img src="data:image/jpeg;base64,${kmiBase64}" alt="KMI Logo" class="cover-logo-kmi" />` : ''}
              ${mahadBase64 ? `<img src="data:image/png;base64,${mahadBase64}" alt="Mahad Logo" class="cover-logo-mahad" />` : ''}
            </div>

            <!-- Institution Header -->
            <div class="cover-header-section">
              <div class="cover-institution-location">لاهات – سومطرة الجنوبية – اندونيسيا</div>
            </div>

            <!-- Title Section -->
            <div class="cover-title-section">
              <div style="display: flex; justify-content: center;">
                ${kashfuBase64 ? `<img src="data:image/jpeg;base64,${kashfuBase64}" alt="Kasyfu Title" class="cover-title-image" />` : ''}
              </div>
              <div class="cover-semester-info">${semesterLabel || 'للفصل الدراسي الثاني'}</div>
              <div class="cover-year-info">
                <div>${schoolYear || 'عام ٢٠٢٥-٢٠٢٤'} ${schoolYearGregorian ? `| ${schoolYearGregorian}` : '| ١٤٤٦ – ١٤٤٥'}</div>
              </div>
            </div>

            <!-- Student Information -->
            <div class="cover-student-info">
              <div class="cover-info-row">
                <span class="cover-info-value"><strong>${studentName}</strong></span>
                <span class="cover-separator">:</span>
                <span class="cover-info-label">اسم الطالب</span>
              </div>
              <div class="cover-info-row">
                <span class="cover-info-value"><strong>${className}</strong></span>
                <span class="cover-separator">:</span>
                <span class="cover-info-label">الفصل</span>
              </div>
              <div class="cover-info-row">
                <span class="cover-info-value"><strong>${studentNo}</strong></span>
                <span class="cover-separator">:</span>
                <span class="cover-info-label">رقم دفتر القيد</span>
              </div>
              <div class="cover-info-row">
                <span class="cover-info-value"><strong>LAHAT</strong></span>
                <span class="cover-separator">:</span>
                <span class="cover-info-label">الدائرة</span>
              </div>
            </div>

            <!-- Serial Number -->
            <div class="cover-serial-section">
              <div class="cover-serial-box">${raportNo || '-'}</div>
            </div>
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

    
    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,      timeout: 60000,
      protocolTimeout: 60000,    });

    const page = await browser.newPage();

    // Set viewport for F4
    await page.setViewport({
      width: 2480, // 215mm at 300 DPI
      height: 3508, // 330mm at 300 DPI
      deviceScaleFactor: 1,
    });

    // Set content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

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
    });

    await browser.close();

    // Convert to base64
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

    return NextResponse.json({
      success: true,
      pdf: pdfDataUrl,
      fileName: `cover-${studentName.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
    });
  } catch (error) {
    serverError('[GenerateCoverPDF] Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        serverError('[GenerateCoverPDF] Error closing browser:', e);
      }
    }
    const errorMessage = error instanceof Error ? error.message : 'Gagal membuat PDF cover';
    serverError('[GenerateCoverPDF] Returning error:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
