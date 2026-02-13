import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  let browser = null;
  try {
    const data = await request.json();
    const { student, subjectScores } = data;

    if (!student || !subjectScores) {
      return NextResponse.json(
        { success: false, error: 'Data raport tidak lengkap' },
        { status: 400 }
      );
    }

    // Helper functions
    const toArabicNumerals = (num: number | string): string => {
      const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).split('').map(digit => {
        if (digit >= '0' && digit <= '9') {
          return arabicDigits[parseInt(digit)];
        }
        return digit;
      }).join('');
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

    // Generate HTML content
    const rightColumn = subjectScores.slice(0, Math.ceil(subjectScores.length / 2));
    const leftColumn = subjectScores.slice(Math.ceil(subjectScores.length / 2));
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
        subjectsHTML += `<td style="text-align: center; padding: 8px;">${toArabicNumerals(rightSubject.kkm.toString())}</td>`;
        subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(rightSubject.averageScore.toFixed(1))}</strong></td>`;
        subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${scoreToArabicText(rightSubject.averageScore)}</strong></td>`;
      } else {
        subjectsHTML += '<td></td><td></td><td></td><td></td>';
      }

      // Left side
      if (leftSubject) {
        const subjectName = leftSubject.subjectArabicName || leftSubject.subject;
        subjectsHTML += `<td style="text-align: right; white-space: nowrap; padding: 8px;">${subjectName}</td>`;
        subjectsHTML += `<td style="text-align: center; padding: 8px;">${toArabicNumerals(leftSubject.kkm.toString())}</td>`;
        subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${toArabicNumerals(leftSubject.averageScore.toFixed(1))}</strong></td>`;
        subjectsHTML += `<td style="text-align: center; padding: 8px;"><strong>${scoreToArabicText(leftSubject.averageScore)}</strong></td>`;
      } else {
        subjectsHTML += '<td></td><td></td><td></td><td></td>';
      }
      subjectsHTML += '</tr>';
    }

    const avgScore = (subjectScores.reduce((sum: number, s: any) => sum + s.averageScore, 0) / subjectScores.length).toFixed(1);

    // Convert image to base64
    let logoBase64 = '';
    try {
      const imagePath = join(process.cwd(), 'public', 'namapondok.png');
      const imageBuffer = readFileSync(imagePath);
      logoBase64 = imageBuffer.toString('base64');
    } catch (err) {
      console.log('Logo not found, continuing without it');
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Peserta Didik</title>
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
            .footer-section {
                margin-top: auto;
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
            thead th {
                background: #e9e9e9;
                font-weight: bold;
                padding: 8px;
            }
            tbody td {
                padding: 4px 5px;
            }
            .no-border td {
                border: none;
                padding: 2px 6px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
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
            .footer-section table td {
                border: none !important;
            }
            .footer-section table td div {
                padding-bottom: 8px;
            }
        </style>
    </head>
    <body>
        <div class="a4-page">
            <div class="watermark-bg">
                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Trademark" />` : ''}
            </div>
            <div class="page-content">
                <h1>بسم الله الرحمن الرحيم</h1>
                <table class="info-table">
                    <tr>
                        <td class="label">الاسم</td>
                        <td>: ${student.name || '-'}</td>
                        <td class="label right">رقم دفتر القيد</td>
                        <td>: ${student.studentNo || '-'}</td>
                        <td class="label right">الفصل</td>
                        <td>: ${student.class || '-'}</td>
                    </tr>
                </table>

                <table style="margin-top: 8px;">
                    <thead>
                        <tr>
                            <th rowSpan="2" style="width: 14%;">المواد</th>
                            <th colSpan="3" style="width: 36%;">الدرجة</th>
                            <th rowSpan="2" style="width: 14%;">المواد</th>
                            <th colSpan="3" style="width: 36%;">الدرجة</th>
                        </tr>
                        <tr>
                            <th style="width: 12%;">المعدلة للفصل</th>
                            <th style="width: 12%;">الأرقام</th>
                            <th style="width: 12%;">الحروف</th>
                            <th style="width: 12%;">المعدلة للفصل</th>
                            <th style="width: 12%;">الأرقام</th>
                            <th style="width: 12%;">الحروف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subjectsHTML}
                    </tbody>
                </table>

                <table style="margin-top: 8px;">
                    <tbody>
                        <tr>
                            <th>الرتبة</th>
                            <td class="center">---</td>
                            <th>المعدل العام</th>
                            <td class="center">
                                <strong>${toArabicNumerals(avgScore)}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table style="margin-top: 8px;">
                    <tbody>
                        <tr>
                            <th>السلوك</th>
                            <td class="center">٨</td>
                            <td class="center">ثمان</td>
                        </tr>
                        <tr>
                            <th>المواظبة</th>
                            <td class="center">٨</td>
                            <td class="center">ثمان</td>
                        </tr>
                        <tr>
                            <th>النظافة</th>
                            <td class="center">٨</td>
                            <td class="center">ثمان</td>
                        </tr>
                    </tbody>
                </table>

                <table style="margin-top: 8px; font-size: 11px;">
                    <tbody>
                        <tr>
                            <th>تقدير الدرجات: ١–٣ : ضعيف جداً،   ٤–٥ : ضعيف، ٦ : مقبول، ٧ : جيد، ٨ : جيد جداً، ٩–١٠ : ممتاز </th>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="footer-section">
                <table style="margin-top: 10px; width: 100%;">
                    <tbody>
                        <tr style="height: auto;">
                            <td style="width: 33%; text-align: right; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                                <div style="margin-bottom: 50px; padding-top: 8px;">
                                    تقرير بدار السلام لاهات، في 21 يونيو 2026
                                </div>
                            </td>
                            <td style="width: 34%; text-align: center; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                                <div style="margin-bottom: 8px; font-weight: bold;">
                                    مدير المعهد دار السلام لاهات
                                </div>
                                <div style="border-top: 1px solid #000; margin-top: 45px; padding-top: 8px;"></div>
                                <div style="margin-top: 8px; font-size: 12px;">
                                    الأستاذ محمد رومي أوكتاريوس،
                                </div>
                            </td>
                            <td style="width: 33%; text-align: center; padding: 8px; border: 1px solid #000; font-size: 12px; vertical-align: top;">
                                <div style="margin-bottom: 8px; font-weight: bold;">
                                    الملاحظة
                                </div>
                                <div style="font-size: 14px; margin-bottom: 12px; font-weight: bold;">
                                    ضعيف جدًا
                                </div>
                                <div style="font-size: 10px; margin-top: 40px; padding-top: 8px; border-top: 1px solid #ccc;">
                                    SERIAL: UAS-SMT-2-24/25-PA-31
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;

    // Launch Puppeteer
    let executablePath: string;
    try {
      executablePath = await chromium.executablePath();
      console.log('Using Chromium from @sparticuz/chromium:', executablePath);
    } catch (err) {
      console.log('Chromium path from @sparticuz failed, falling back to puppeteer');
      executablePath = puppeteer.executablePath();
    }
    
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-translate',
      '--disable-sync',
      '--disable-plugins',
      '--disable-web-resources',
      '--disable-default-apps',
    ];

    console.log('Launching browser with executable:', executablePath);
    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: 'new',
    }).catch((launchErr) => {
      console.error('Launch error details:', {
        message: launchErr.message,
        code: launchErr.code,
        executablePath,
        args: launchArgs,
      });
      throw launchErr;
    });

    const page = await browser.newPage();

    // Set viewport to match F4 size
    await page.setViewport({
      width: 825,  // 215mm in pixels (approximately)
      height: 1260, // 330mm in pixels (approximately)
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

    return NextResponse.json({
      success: true,
      pdf: `data:application/pdf;base64,${base64}`,
      fileName: `Raport_${student.name?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
    });
  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', {
      error: String(error),
      errorMsg: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'N/A',
      environment: process.env.VERCEL ? 'Vercel' : 'Local',
      nodeVersion: process.version,
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
        environment: process.env.VERCEL ? 'Vercel' : 'Local',
        debug: process.env.NODE_ENV === 'development' ? {
          errorMsg: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
