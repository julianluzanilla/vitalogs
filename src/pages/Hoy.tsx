import { useEffect, useState } from 'react';
import type { Entry } from '../../shared/model';
import { useDisplayName, useEntryOpener } from '../components/AppShell';
import { EntryList } from '../components/EntryRow';
import { Icon } from '../components/Icon';
import { TypeTiles } from '../components/TypeTiles';
import { useEntries } from '../hooks/useData';
import { countLabel, ds, greeting, relTime, todayLong } from '../lib/format';

/** Re-renderiza cada minuto para refrescar saludos y tiempos relativos. */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Hoy() {
  const now = useMinuteTick();
  const entries = useEntries();
  const name = useDisplayName();
  const { openNew, openEdit } = useEntryOpener();
  const today = ds(now);
  const todayItems = entries.filter((e) => e.date === today);
  const lastP = entries.find((e): e is Extract<Entry, { type: 'presion' }> => e.type === 'presion');
  const lastL = entries.find((e): e is Extract<Entry, { type: 'lpm' }> => e.type === 'lpm');

  return (
    <>
      <div className="page-head">
        <div className="page-kicker">{todayLong(now)}</div>
        <h1 className="page-title">{greeting(name, now)}</h1>
      </div>
      <div className="grid-2">
        <div className="stack">
          <section className="hero">
            <button className="hero-half" onClick={() => openNew('presion')}>
              <span className="hero-label">
                <Icon name="presion" />
                Presión
              </span>
              <span className="hero-value">
                <b>{lastP ? `${lastP.sys}/${lastP.dia}` : '—'}</b>
                <span>mmHg</span>
              </span>
              <span className="hero-when">{relTime(lastP, now)}</span>
            </button>
            <button className="hero-half" onClick={() => openNew('lpm')}>
              <span className="hero-label">
                <Icon name="lpm" />
                Pulso
              </span>
              <span className="hero-value">
                <b>{lastL ? lastL.value : '—'}</b>
                <span>lpm</span>
              </span>
              <span className="hero-when">{relTime(lastL, now)}</span>
            </button>
          </section>
          <section className="section">
            <h2 className="section-title">Registrar</h2>
            <TypeTiles onPick={openNew} />
          </section>
        </div>
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Hoy</h2>
            <span className="count">{countLabel(todayItems.length)}</span>
          </div>
          {todayItems.length ? <EntryList entries={todayItems} onOpen={openEdit} /> : <div className="empty">Aún no hay registros hoy.</div>}
        </section>
      </div>
    </>
  );
}
