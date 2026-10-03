import { useMemo, useState } from 'react';
import { ORDER, TYPES, type EntryType } from '../../shared/model';
import { useDisplayName } from '../components/AppShell';
import { ExportSheet } from '../components/ExportSheet';
import { Icon, IconChip } from '../components/Icon';
import { Chip } from '../components/TypeTiles';
import { useEntries } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import type { ExportFile } from '../lib/export/share';
import { countLabel, longDate } from '../lib/format';
import { computeReport, RANGES, reportText, type RangeKey } from '../lib/report';

const KEY = 'vitalogs.report';

function loadPrefs(): { range: RangeKey; types: EntryType[] } {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '');
    if (p && RANGES.some(([k]) => k === p.range) && Array.isArray(p.types)) return { range: p.range, types: p.types.filter((t: EntryType) => ORDER.includes(t)) };
  } catch {
    /* sin preferencias guardadas */
  }
  return { range: '30', types: ORDER.slice() };
}

export function Reportes() {
  const entries = useEntries();
  const name = useDisplayName();
  const toast = useToast();
  const [prefs] = useState(loadPrefs);
  const [range, setRange] = useState<RangeKey>(prefs.range);
  const [types, setTypes] = useState<EntryType[]>(prefs.types);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<'' | 'pdf' | 'xlsx'>('');
  const [file, setFile] = useState<{ file: ExportFile; title: string } | null>(null);

  const report = useMemo(() => computeReport(entries, { range, from, to, types, name }), [entries, range, from, to, types, name]);

  const savePrefs = (r: RangeKey, t: EntryType[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ range: r, types: t }));
    } catch {
      /* almacenamiento no disponible */
    }
  };
  const pickRange = (r: RangeKey) => {
    setRange(r);
    savePrefs(r, types);
  };
  const toggleType = (t: EntryType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    setTypes(next);
    savePrefs(range, next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(report));
      toast('Resumen copiado');
    } catch {
      toast('No se pudo copiar');
    }
  };

  const exportAs = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind);
    try {
      // Carga diferida: estas librerías solo se descargan al exportar.
      const f = kind === 'pdf' ? (await import('../lib/export/pdf')).buildPdf(report) : await (await import('../lib/export/xlsx')).buildXlsx(report);
      setFile({ file: f, title: kind === 'pdf' ? 'Reporte PDF listo' : 'Reporte Excel listo' });
    } catch (err) {
      console.error(err);
      toast('No se pudo generar el archivo');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="report-head">
        <div className="page-head">
          <h1 className="page-title">Reportes</h1>
          <div style={{ fontSize: 15, color: 'var(--muted)' }}>Resumen para tu médico</div>
        </div>
        <div className="report-actions">
          <button className="btn btn-secondary" onClick={copy}>
            <Icon name="copy" />
            Copiar
          </button>
          <button className="btn btn-secondary" onClick={() => exportAs('xlsx')} disabled={!!busy}>
            <Icon name="download" />
            {busy === 'xlsx' ? 'Generando…' : 'Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => exportAs('pdf')} disabled={!!busy}>
            <Icon name="share" />
            {busy === 'pdf' ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="card filters">
        <div className="filter-group">
          <span className="label">Periodo</span>
          <div className="chips">
            {RANGES.map(([k, l]) => (
              <Chip key={k} on={range === k} onClick={() => pickRange(k)}>
                {l}
              </Chip>
            ))}
          </div>
          {range === 'custom' && (
            <div className="date-range">
              <label>
                Desde
                <input className="input alt" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                Hasta
                <input className="input alt" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
        </div>
        <div className="filter-group">
          <span className="label">Incluir</span>
          <div className="chips">
            {ORDER.map((t) => (
              <Chip key={t} on={types.includes(t)} onClick={() => toggleType(t)}>
                {TYPES[t].label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <article className="card report">
        <header className="report-header">
          <div className="t">Reporte de salud</div>
          <div className="n">
            {name} · {report.rangeLabel}
          </div>
          <div className="g">
            Generado el {longDate(report.generated)} · {countLabel(report.total)}
          </div>
        </header>
        {!report.sections.length && <div style={{ color: 'var(--muted)', fontSize: 15 }}>No hay registros en este periodo.</div>}
        {report.sections.map((sec) => (
          <section className="section" key={sec.type}>
            <div className="report-sec-head">
              <IconChip name={sec.icon} size="sm" />
              <h3>{sec.title}</h3>
            </div>
            <div className="stats">
              {sec.stats.map((s) => (
                <div className="stat" key={s.label}>
                  <small>{s.label}</small>
                  <b>{s.value}</b>
                </div>
              ))}
            </div>
            <div className="report-rows">
              {sec.rows.map((r, i) => (
                <div className="report-row" key={i}>
                  <span className="w">{r.when}</span>
                  <span className="x">{r.text}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </article>

      {file && <ExportSheet file={file.file} title={file.title} onClose={() => setFile(null)} />}
    </>
  );
}
