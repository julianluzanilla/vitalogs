import type { ReactNode } from 'react';
import { ORDER, TYPES, type EntryType } from '../../shared/model';
import { IconChip } from './Icon';

export function TypeTiles({ onPick }: { onPick: (t: EntryType) => void }) {
  return (
    <div className="tiles">
      {ORDER.map((t) => (
        <button key={t} className="tile" onClick={() => onPick(t)}>
          <IconChip name={TYPES[t].icon} />
          <span className="tile-label">{TYPES[t].label}</span>
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, size }: { on: boolean; onClick: () => void; children: ReactNode; size?: 'sm' | 'lg' }) {
  return (
    <button type="button" className={`chip${size ? ` chip-${size}` : ''}${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
