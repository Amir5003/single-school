import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Load an image URL as a data URL (so jsPDF can embed it without CORS issues
 * if the server sends Access-Control-Allow-Origin: *). Falls back to null on
 * any failure.
 */
const loadImageAsDataUrl = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ── Layout constants ─────────────────────────────────────────────────────────
const MARGIN_X = 40;
const BAND_HEIGHT = 96;
const INK = '#111827';
const MUTED = '#6b7280';
const HAIRLINE = '#e5e7eb';
const PANEL = '#f9fafb';

/**
 * Draw the coloured school-identity band across the top of the page.
 * Returns the y coordinate directly below it.
 */
function drawHeader(doc, school, logoData, pageWidth) {
  doc.setFillColor(school.primaryColor || '#1a73e8');
  doc.rect(0, 0, pageWidth, BAND_HEIGHT, 'F');

  let textX = MARGIN_X;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', MARGIN_X, 25, 46, 46);
      textX = MARGIN_X + 60;
    } catch {
      // fall through, render text-only
    }
  }

  // Address and phone share a line — three stacked meta lines crowd the band.
  const metaLines = [];
  if (school.tagline) metaLines.push(school.tagline);
  const contact = [school.address, school.contactNumber && `Phone: ${school.contactNumber}`]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) metaLines.push(contact);

  const maxTextWidth = pageWidth - textX - MARGIN_X;

  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const nameLines = doc.splitTextToSize(school.name || 'School', maxTextWidth).slice(0, 2);

  // Centre the whole identity block vertically inside the band.
  const blockHeight = nameLines.length * 20 + metaLines.length * 12;
  let y = (BAND_HEIGHT - blockHeight) / 2 + 14;

  nameLines.forEach((line) => {
    doc.text(line, textX, y);
    y += 20;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  metaLines.forEach((line) => {
    doc.text(doc.splitTextToSize(line, maxTextWidth)[0], textX, y);
    y += 12;
  });

  return BAND_HEIGHT;
}

/**
 * Student details panel — a 2x2 grid of label/value pairs. Both columns start
 * at a fixed x, so every value lines up regardless of label length.
 */
function drawDetailsPanel(doc, payload, pageWidth, top) {
  const width = pageWidth - MARGIN_X * 2;
  const height = 64;
  const padX = 14;
  const colWidth = width / 2;

  doc.setFillColor(PANEL);
  doc.setDrawColor(HAIRLINE);
  doc.roundedRect(MARGIN_X, top, width, height, 6, 6, 'FD');

  const cells = [
    ['STUDENT', payload.student.name || '—'],
    ['CLASS', payload.student.class || '—'],
    ['ENROLLMENT ID', payload.student.enrollmentId || '—'],
    ['RANK', payload.rank != null ? `#${payload.rank}` : '—'],
  ];

  cells.forEach(([label, value], i) => {
    const x = MARGIN_X + padX + (i % 2) * colWidth;
    const y = top + 22 + Math.floor(i / 2) * 28;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(label, x, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text(
      doc.splitTextToSize(String(value), colWidth - padX * 2)[0],
      x,
      y + 13
    );
  });

  return top + height;
}

/**
 * Result summary — a right-aligned box with labels left, values right, so the
 * two rows read as a pair instead of drifting apart.
 */
function drawSummary(doc, payload, pageWidth, top) {
  const width = 250;
  const height = 60;
  const x = pageWidth - MARGIN_X - width;
  const padX = 14;

  doc.setFillColor(PANEL);
  doc.setDrawColor(HAIRLINE);
  doc.roundedRect(x, top, width, height, 6, 6, 'FD');

  const rows = [
    ['Overall Percentage', `${payload.percentage}%`, INK],
    ['Overall Result', payload.passed ? 'PASS' : 'FAIL', payload.passed ? '#15803d' : '#b91c1c'],
  ];

  rows.forEach(([label, value, colour], i) => {
    const y = top + 24 + i * 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(label, x + padX, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colour);
    doc.text(String(value), x + width - padX, y, { align: 'right' });
  });

  return top + height;
}

function drawFooter(doc, payload, pageWidth) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 34;

  doc.setDrawColor(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y - 12, pageWidth - MARGIN_X, y - 12);

  doc.setTextColor(MUTED);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on ${formatDate(payload.generatedAt || new Date())}`, MARGIN_X, y);
  doc.text('This is a system-generated report card.', pageWidth - MARGIN_X, y, {
    align: 'right',
  });
}

/**
 * Generate a single-page report card PDF from the backend's payload.
 * Returns the jsPDF document (caller is responsible for `.save(filename)`).
 */
export async function generateReportCard(payload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoData = await loadImageAsDataUrl(payload.school.logoUrl);

  const headerBottom = drawHeader(doc, payload.school, logoData, pageWidth);

  // Report-card title
  doc.setTextColor(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('REPORT CARD', pageWidth / 2, headerBottom + 34, { align: 'center' });

  // Exam meta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED);
  doc.text(
    `${payload.exam.name}  —  ${payload.exam.term}, ${payload.exam.year}`,
    pageWidth / 2,
    headerBottom + 52,
    { align: 'center' }
  );

  const detailsBottom = drawDetailsPanel(doc, payload, pageWidth, headerBottom + 70);

  // Marks table. Column alignment is applied in didParseCell so the header,
  // body and total row of a column always share one alignment — setting it
  // through columnStyles alone leaves headers hanging off their numbers.
  autoTable(doc, {
    startY: detailsBottom + 24,
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 60 },
    head: [['Subject', 'Marks Obtained', 'Max Marks', 'Pass Mark', 'Result']],
    body: payload.marks.map((m) => [
      m.subject,
      String(m.marksObtained),
      String(m.totalMarks),
      String(m.passMark),
      m.passed ? 'Pass' : 'Fail',
    ]),
    foot: [
      [
        'Total',
        String(payload.totals.obtained),
        String(payload.totals.total),
        '',
        payload.passed ? 'Pass' : 'Fail',
      ],
    ],
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
      lineColor: HAIRLINE,
      lineWidth: 0.5,
      textColor: INK,
    },
    headStyles: {
      fillColor: payload.school.primaryColor || '#1a73e8',
      textColor: '#ffffff',
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    footStyles: { fillColor: '#f3f4f6', textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#fbfbfd' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 95 },
      2: { cellWidth: 72 },
      3: { cellWidth: 72 },
      4: { cellWidth: 60 },
    },
    didParseCell: (data) => {
      data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
    },
    didDrawPage: () => drawFooter(doc, payload, pageWidth),
  });

  drawSummary(doc, payload, pageWidth, doc.lastAutoTable.finalY + 22);

  return doc;
}

/**
 * Convenience: generate and save with a sensible filename.
 */
export async function downloadReportCard(payload) {
  const doc = await generateReportCard(payload);
  const safeName = (payload.student.name || 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const safeExam = (payload.exam.name || 'exam').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`report-card-${safeName}-${safeExam}.pdf`);
}
