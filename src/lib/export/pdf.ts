import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { countLabel, longDate } from '../format';
import type { Report } from '../report';
import { reportFileBase } from '../report';
import { COLUMNS, dmy } from './columns';
import { PDF_TYPE, type ExportFile } from './share';

const INK: [number, number, number] = [11, 46, 59];
const MUTED: [number, number, number] = [85, 116, 129];
const PRIMARY: [number, number, number] = [10, 94, 128];
const TEAL: [number, number, number] = [22, 148, 125];
const LINE: [number, number, number] = [205, 236, 239];
const TILE: [number, number, number] = [239, 247, 255];

// Las fuentes estándar de PDF usan WinAnsi: se sustituyen los pocos caracteres que no existen ahí.
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/…/g, '...');

const M = 16; // margen (mm)

/** Logo dibujado con primitivas (jsPDF no dibuja SVG). */
function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(...TEAL);
  doc.roundedRect(x, y, size, size, size * 0.28, size * 0.28, 'F');
  const k = size / 64;
  const pts: [number, number][] = [
    [9, 33],
    [19, 33],
    [24, 20],
    [32, 45],
    [40, 20],
    [45, 33],
    [51, 33],
  ];
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(5 * k);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  for (let i = 1; i < pts.length; i++) doc.line(x + pts[i - 1][0] * k, y + pts[i - 1][1] * k, x + pts[i][0] * k, y + pts[i][1] * k);
  doc.setFillColor(225, 251, 215);
  doc.circle(x + 54 * k, y + 33 * k, 3.5 * k, 'F');
}

export function buildPdf(r: Report): ExportFile {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - 18) {
      doc.addPage();
      y = M;
    }
  };

  // Encabezado
  drawLogo(doc, M, y, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text('Reporte de salud', M + 17, y + 6.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('VitaLogs', M + 17, y + 11.5);
  y += 21;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(clean(r.name || 'Paciente'), M, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(clean(`Periodo: ${r.rangeLabel}`), M, y);
  y += 5;
  doc.text(clean(`Generado el ${longDate(r.generated)} · ${countLabel(r.total)}`), M, y);
  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 8;

  if (!r.sections.length) {
    doc.setTextColor(...MUTED);
    doc.text('No hay registros en este periodo.', M, y);
  }

  for (const sec of r.sections) {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...PRIMARY);
    doc.text(clean(sec.title), M, y);
    y += 2.5;
    doc.setDrawColor(...LINE);
    doc.line(M, y, W - M, y);
    y += 4;

    // Recuadros de estadísticas, 4 por fila
    const perRow = 4;
    const gap = 3;
    const tw = (W - 2 * M - gap * (perRow - 1)) / perRow;
    const th = 14;
    sec.stats.forEach((s, i) => {
      const col = i % perRow;
      if (col === 0 && i) y += th + gap;
      if (col === 0) ensure(th);
      const x = M + col * (tw + gap);
      doc.setFillColor(...TILE);
      doc.roundedRect(x, y, tw, th, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(clean(s.label), x + 3, y + 5, { maxWidth: tw - 6 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...INK);
      doc.text(clean(s.value), x + 3, y + 11, { maxWidth: tw - 6 });
    });
    y += th + 5;

    const cols = COLUMNS[sec.type];
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 18 },
      head: [cols.map((c) => c.header)],
      body: sec.entries.map((e) =>
        cols.map((c) => {
          const v = c.value(e);
          if (c.header === 'Fecha' && typeof v === 'string') return dmy(v);
          return v == null ? '' : clean(String(v));
        }),
      ),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, lineColor: LINE, lineWidth: 0.2, cellPadding: 1.8, overflow: 'linebreak' },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 251, 253] },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, c.numeric ? { halign: 'right' as const } : {}])),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(clean(`${r.name} · ${r.rangeLabel}`), M, H - 9);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 9, { align: 'right' });
  }

  return { blob: new Blob([doc.output('arraybuffer')], { type: PDF_TYPE }), name: `${reportFileBase(r)}.pdf` };
}
