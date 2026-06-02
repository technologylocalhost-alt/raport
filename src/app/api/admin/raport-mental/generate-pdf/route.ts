import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
}

export async function POST(request: NextRequest) {
  let browser: puppeteer.Browser | null = null;

  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { html, fileName } = await request.json();
    if (!html || typeof html !== 'string') {
      return NextResponse.json({ success: false, error: 'HTML laporan wajib diisi' }, { status: 400 });
    }

    let executablePath = '';
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      try {
        executablePath = await chromium.executablePath();
      } catch {
        executablePath = puppeteer.executablePath();
      }
    }

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      timeout: 60000,
      protocolTimeout: 60000,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    await browser.close();
    browser = null;

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const safeName = String(fileName || 'raport-mental.pdf')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    return NextResponse.json({
      success: true,
      pdf: `data:application/pdf;base64,${pdfBase64}`,
      fileName: safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`,
    });
  } catch (error) {
    console.error('Generate raport mental PDF error:', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Gagal membuat PDF' },
      { status: 500 }
    );
  }
}
