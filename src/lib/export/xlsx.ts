import ExcelJS from 'exceljs';
import { countLabel, longDate } from '../format';
import type { Report } from '../report';
import { reportFileBase } from '../report';
import { COLUMNS } from './columns';
import { XLSX_TYPE, type ExportFile } from './share';

const PRIMARY = 'FF0A5E80';
const INK = 'FF0B2E3B';
const MUTED = 'FF557481';
const TILE = 'FFEFF7FF';
const LINE = 'FFCDECEF';

/** Fecha como celda de Excel real (sin desfase de zona horaria). */
const excelDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};

export async function buildXlsx(r: Report): Promise<ExportFile> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VitaLogs';
  wb.created = new Date();

  // ── Hoja Resumen ──
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 28 }, { width: 22 }];
  ws.addRow(['Reporte de salud']).font = { bold: true, size: 18, color: { argb: INK } };
  ws.addRow([r.name]).font = { bold: true, size: 12, color: { argb: INK } };
  ws.addRow([`Periodo: ${r.rangeLabel}`]).font = { color: { argb: MUTED } };
  ws.addRow([`Generado el ${longDate(r.generated)} · ${countLabel(r.total)} · VitaLogs`]).font = { color: { argb: MUTED } };
  ws.addRow([]);
  if (!r.sections.length) ws.addRow(['No hay registros en este periodo.']);
  for (const sec of r.sections) {
    const h = ws.addRow([sec.title]);
    h.font = { bold: true, size: 13, color: { argb: PRIMARY } };
    h.getCell(1).border = { bottom: { style: 'thin', color: { argb: LINE } } };
    h.getCell(2).border = { bottom: { style: 'thin', color: { argb: LINE } } };
    for (const s of sec.stats) {
      const num = Number(s.value);
      const row = ws.addRow([s.label, Number.isFinite(num) && s.value.trim() !== '' ? num : s.value]);
      row.getCell(1).font = { color: { argb: MUTED } };
      row.getCell(2).font = { bold: true, color: { argb: INK } };
      row.getCell(2).alignment = { horizontal: 'right' };
      row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TILE } }));
    }
    ws.addRow([]);
  }

  // ── Una hoja por tipo ──
  for (const sec of r.sections) {
    const cols = COLUMNS[sec.type];
    const sheet = wb.addWorksheet(sec.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    const head = sheet.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    head.alignment = { vertical: 'middle' };
    head.height = 20;
    // Orden cronológico ascendente: más cómodo para filtrar y graficar.
    for (const e of sec.entries.slice().reverse()) {
      const row = sheet.addRow(cols.map((c) => (c.header === 'Fecha' ? excelDate(e.date) : c.value(e))));
      row.getCell(1).numFmt = 'dd/mm/yyyy';
    }
    cols.forEach((c, i) => {
      if (c.header === 'Observaciones' || c.header === 'Síntoma') sheet.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' };
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buf], { type: XLSX_TYPE }), name: `${reportFileBase(r)}.xlsx` };
}
