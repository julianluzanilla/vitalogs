import ExcelJS from 'exceljs';
import { countLabel, longDate } from '../format';
import { AMOUNTS } from '../../../shared/model';
import type { Report } from '../report';
import { hasPartialNote, PARTIAL_NOTE, reportFileBase } from '../report';
import { columnsFor, DAILY_HEADERS, type Column } from './columns';
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
    if (hasPartialNote(sec)) ws.addRow([PARTIAL_NOTE]).font = { italic: true, size: 9, color: { argb: MUTED } };
    ws.addRow([]);
  }

  const tableSheet = (name: string, cols: Pick<Column, 'header' | 'width'>[]) => {
    const sheet = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    const head = sheet.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    head.alignment = { vertical: 'middle' };
    head.height = 20;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return sheet;
  };

  // ── Una hoja por sección (y para pipí / popó, otra con el conteo por día) ──
  for (const sec of r.sections) {
    if (sec.daily) {
      const daily = tableSheet(`${sec.title} por día`, DAILY_HEADERS.map((h, i) => ({ header: h, width: i ? 10 : 12 })));
      for (const d of sec.daily.slice().reverse()) {
        const row = daily.addRow([excelDate(d.date), d.total, ...AMOUNTS.map((a) => d.amounts[a])]);
        row.getCell(1).numFmt = 'dd/mm/yyyy';
        if (d.partial) row.getCell(1).note = 'Día en curso al generar el reporte';
      }
    }
    const cols = columnsFor(sec.type, sec.entries, r.body);
    const sheet = tableSheet(sec.title, cols);
    // Orden cronológico ascendente: más cómodo para filtrar y graficar.
    for (const e of sec.entries.slice().reverse()) {
      const row = sheet.addRow(cols.map((c) => (c.header === 'Fecha' ? excelDate(e.date) : c.value(e, r.body))));
      row.getCell(1).numFmt = 'dd/mm/yyyy';
    }
    cols.forEach((c, i) => {
      if (c.header === 'Observaciones' || c.header === 'Síntoma') sheet.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return { blob: new Blob([buf], { type: XLSX_TYPE }), name: `${reportFileBase(r)}.xlsx` };
}
