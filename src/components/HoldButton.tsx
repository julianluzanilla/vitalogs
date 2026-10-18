import { useState, type ReactNode } from 'react';

/**
 * Botón que solo dispara al mantenerlo presionado (dedo, ratón o Enter/Espacio).
 * El relleno es una animación CSS; su fin es lo que confirma la acción.
 */
export function HoldButton({ className, label, onConfirm, onTap, children }: { className: string; label: string; onConfirm: () => void; onTap: () => void; children: ReactNode }) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const start = () => (setDone(false), setHolding(true));
  const stop = () => {
    if (holding && !done) onTap();
    setHolding(false);
  };
  return (
    <button
      className={`${className} hold${holding ? ' holding' : ''}`}
      title={label}
      aria-label={`${label} (mantén presionado)`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={() => setHolding(false)}
      onPointerCancel={() => setHolding(false)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && (e.preventDefault(), start())}
      onKeyUp={(e) => (e.key === 'Enter' || e.key === ' ') && stop()}
      onAnimationEnd={() => {
        setDone(true);
        onConfirm();
      }}
    >
      {children}
    </button>
  );
}
