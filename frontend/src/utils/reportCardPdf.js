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

/**
 * Generate a single-page report card PDF from the backend's payload.
 * Returns the jsPDF document (caller is responsible for `.save(filename)`).
 */
export async function generateReportCard(payload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Try to embed school logo
  const logoData = await loadImageAsDataUrl(payload.school.logoUrl);

  // Header band — school identity
  doc.setFillColor(payload.school.primaryColor || '#1a73e8');
  doc.rect(0, 0, pageWidth, 90, 'F');

  let textStartX = marginX;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', marginX, 20, 50, 50);
      textStartX = marginX + 65;
    } catch {
      // fall through, render text-only
    }
  }

  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(payload.school.name || 'School', textStartX, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (payload.school.tagline) {
    doc.text(payload.school.tagline, textStartX, 55);
  }
  if (payload.school.address) {
    doc.text(payload.school.address, textStartX, 68);
  }
  if (payload.school.contactNumber) {
    doc.text(`Phone: ${payload.school.contactNumber}`, textStartX, 80);
  }

  // Report-card title
  doc.setTextColor('#000000');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('REPORT CARD', pageWidth / 2, 120, { align: 'center' });

  // Exam meta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `${payload.exam.name}  —  ${payload.exam.term}, ${payload.exam.year}`,
    pageWidth / 2,
    138,
    { align: 'center' }
  );

  // Student details block
  const detailsY = 165;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Student:', marginX, detailsY);
  doc.text('Enrollment ID:', marginX, detailsY + 16);
  doc.text('Class:', marginX, detailsY + 32);

  doc.setFont('helvetica', 'normal');
  doc.text(payload.student.name || '', marginX + 90, detailsY);
  doc.text(payload.student.enrollmentId || '', marginX + 90, detailsY + 16);
  doc.text(payload.student.class || '—', marginX + 90, detailsY + 32);

  if (payload.rank != null) {
    doc.setFont('helvetica', 'bold');
    doc.text('Rank:', pageWidth - marginX - 90, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${payload.rank}`, pageWidth - marginX - 50, detailsY);
  }

  // Marks table
  autoTable(doc, {
    startY: detailsY + 55,
    margin: { left: marginX, right: marginX },
    head: [['Subject', 'Marks Obtained', 'Max Marks', 'Pass Mark', 'Status']],
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
    styles: { font: 'helvetica', fontSize: 10, halign: 'left' },
    headStyles: {
      fillColor: payload.school.primaryColor || '#1a73e8',
      textColor: '#ffffff',
      fontStyle: 'bold',
    },
    footStyles: { fillColor: '#f3f4f6', textColor: '#111827', fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center' },
    },
  });

  // Summary box below table
  const finalY = doc.lastAutoTable.finalY + 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Overall Percentage:', marginX, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${payload.percentage}%`, marginX + 160, finalY);

  doc.setFont('helvetica', 'bold');
  doc.text('Overall Result:', marginX, finalY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(payload.passed ? '#15803d' : '#b91c1c');
  doc.text(payload.passed ? 'PASS' : 'FAIL', marginX + 160, finalY + 18);

  // Footer
  doc.setTextColor('#6b7280');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Generated on ${formatDate(payload.generatedAt || new Date())}`,
    marginX,
    doc.internal.pageSize.getHeight() - 30
  );
  doc.text(
    'This is a system-generated report card.',
    pageWidth - marginX,
    doc.internal.pageSize.getHeight() - 30,
    { align: 'right' }
  );

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
