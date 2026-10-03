import { useMemo, useState } from 'react';
import { ORDER, TYPES, type Entry, type EntryType } from '../../shared/model';
import { useEntryOpener } from '../components/AppShell';
import { EntryList } from '../components/EntryRow';
import { Chip } from '../components/TypeTiles';
import { useEntries } from '../hooks/useData';
import { countLabel, dayLabel } from '../lib/format';

const PAGE = 60; // días por página, para historiales largos

export function Historial() {
  const entries = useEntries();
  const { openEdit } = useEntryOpener();
  const [filter, setFilter] = useState<EntryType | 'all'>('all');
  const [days, setDays] = useState(PAGE);

  const groups = useMemo(() => {
    const out: { date: string; items: Entry[] }[] = [];
    for (const e of entries) {
      if (filter !== 'all' && e.type !== filter) continue;
      const g = out[out.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else out.push({ date: e.date, items: [e] });
    }
    return out;
  }, [entries, filter]);

  return (
    <>
      <h1 className="page-title">Historial</h1>
      <div className="chips-scroll">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
          Todos
        </Chip>
        {ORDER.map((t) => (
          <Chip key={t} on={filter === t} onClick={() => setFilter(t)}>
            {TYPES[t].label}
          </Chip>
        ))}
      </div>
      {!groups.length && <div className="empty">{filter === 'all' ? 'Aún no hay registros.' : 'No hay registros de este tipo.'}</div>}
      {groups.slice(0, days).map((g) => (
        <section className="section" key={g.date} style={{ gap: 10 }}>
          <div className="group-head">
            <h2>{dayLabel(g.date)}</h2>
            <span>{countLabel(g.items.length)}</span>
          </div>
          <EntryList entries={g.items} onOpen={openEdit} />
        </section>
      ))}
      {groups.length > days && (
        <button className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={() => setDays((d) => d + PAGE)}>
          Ver días anteriores
        </button>
      )}
    </>
  );
}
