import type { CSSProperties } from 'react';

export function Icon({ name, size, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={className ? `ic ${className}` : 'ic'}
      style={{ '--ic': `url(/icons/${name}.svg)`, ...(size ? { width: size, height: size } : null), ...style } as CSSProperties}
    />
  );
}

export function IconChip({ name, size = '' }: { name: string; size?: '' | 'md' | 'sm' }) {
  return (
    <span className={size ? `ic-chip ${size}` : 'ic-chip'}>
      <Icon name={name} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `wordmark ${className}` : 'wordmark'}>
      Vita<span>Logs</span>
    </span>
  );
}
