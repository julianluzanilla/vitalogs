import { useMemo, useState } from 'react';
import { AMOUNTS } from '../../shared/model';
import { useDisplayName } from '../components/AppShell';
import { ExportSheet } from '../components/ExportSheet';
import { Icon, IconChip } from '../components/Icon';
import { Chip } from '../components/TypeTiles';
import { useEntries, useProfile } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import type { ExportFile } from '../lib/export/share';
import { copyText } from '../lib/clipboard';
import { countLabel, longDate, shortDate } from '../lib/format';
import { amountsText, computeReport, hasPartialNote, PARTIAL_NOTE, RANGES, reportText, SECTION_KEYS, SECTIONS, type RangeKey, type SectionKey } from '../lib/report';

const KEY = 'vitalogs.report';

function loadPrefs(): { range: RangeKey; types: SectionKey[] } {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '');
    if (p && RANGES.some(([k]) => k === p.range) && Array.isArray(p.types)) {
      let types: string[] = p.types;
      // v1 tenía "bano" como una sola sección y no tenía peso.
      if (!p.v) types = [...types.flatMap((t) => (t === 'bano' ? ['pipi', 'popo'] : [t])), 'peso'];
      return { range: p.range, types: SECTION_KEYS.filter((k) => types.includes(k)) };
    }
  } catch {
    /* sin preferencias guardadas */
  }
  return { range: '30', types: SECTION_KEYS.slice() };
}

export function Reportes() {
  const entries = useEntries();
  const name = useDisplayName();
  const profile = useProfile();
  const toast = useToast();
  const [prefs] = useState(loadPrefs);
  const [range, setRange] = useState<RangeKey>(prefs.range);
  const [types, setTypes] = useState<SectionKey[]>(prefs.types);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<'' | 'pdf' | 'xlsx'>('');
  const [file, setFile] = useState<{ file: ExportFile; title: string } | null>(null);

  const height = profile?.height;
  const sex = profile?.sex;
  const report = useMemo(
    () => computeReport(entries, { range, from, to, types, name, body: { height, sex } }),
    [entries, range, from, to, types, name, height, sex],
  );

  const savePrefs = (r: RangeKey, t: SectionKey[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 2, range: r, types: t }));
    } catch {
      /* almacenamiento no disponible */
    }
  };
  const pickRange = (r: RangeKey) => {
    setRange(r);
    savePrefs(r, types);
  };
  const toggleType = (t: SectionKey) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : SECTION_KEYS.filter((k) => k === t || types.includes(k));
    setTypes(next);
    savePrefs(range, next);
  };

  const copy = async () => {
    toast((await copyText(reportText(report))) ? 'Resumen copiado' : 'No se pudo copiar');
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
            {SECTIONS.map((s) => (
              <Chip key={s.key} on={types.includes(s.key)} onClick={() => toggleType(s.key)}>
                {s.label}
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
          <section className="section" key={sec.key}>
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
            {hasPartialNote(sec) && <div className="hint">{PARTIAL_NOTE}</div>}
            {sec.daily && (
              <div className="daily-wrap">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Veces</th>
                      {AMOUNTS.map((a) => (
                        <th key={a}>{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.daily.map((d) => (
                      <tr key={d.date} title={amountsText(d)}>
                        <td>
                          {shortDate(d.date)}
                          {d.partial && <small> · en curso</small>}
                        </td>
                        <td>
                          <b>{d.total}</b>
                        </td>
                        {AMOUNTS.map((a) => (
                          <td key={a}>{d.amounts[a] || '·'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
