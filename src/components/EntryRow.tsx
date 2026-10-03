import { TYPES, type Entry } from '../../shared/model';
import { summary } from '../lib/format';
import { IconChip } from './Icon';

export function EntryRow({ entry, onOpen }: { entry: Entry; onOpen: (e: Entry) => void }) {
  const x = summary(entry);
  return (
    <button className="row" onClick={() => onOpen(entry)}>
      <span className="row-time">{entry.time}</span>
      <IconChip name={TYPES[entry.type].icon} size="md" />
      <span className="row-body">
        <span className="row-title">{x.title}</span>
        <span className="row-detail">{x.detail}</span>
      </span>
      {x.badge && <span className="row-badge">{x.badge}</span>}
    </button>
  );
}

export function EntryList({ entries, onOpen }: { entries: Entry[]; onOpen: (e: Entry) => void }) {
  return (
    <div className="list">
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} onOpen={onOpen} />
      ))}
    </div>
  );
}
