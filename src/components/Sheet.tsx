import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWide } from '../hooks/useWide';

export interface DragProps {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
}

interface Props {
  onClose: () => void;
  children: (api: { close: () => void; dragProps: DragProps; wide: boolean }) => ReactNode;
  small?: boolean;
  label?: string;
}

/**
 * Hoja inferior en iPhone (deslizar hacia abajo para cerrar) o modal centrado en PC/iPad.
 * El contenido recibe `close()` (con animación) y `dragProps` para la zona de arrastre.
 */
export function Sheet({ onClose, children, small, label }: Props) {
  const wide = useWide();
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const dragProps: DragProps = {
    onPointerDown(e) {
      if (wide || (e.target as HTMLElement).closest('button, input, textarea, a')) return;
      drag.current = { y: e.clientY, t: Date.now(), dy: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove(e) {
      const d = drag.current;
      if (!d || !panel.current) return;
      d.dy = Math.max(0, e.clientY - d.y);
      panel.current.style.transition = 'none';
      panel.current.style.transform = `translateY(${d.dy}px)`;
    },
    onPointerUp() {
      const d = drag.current;
      drag.current = null;
      if (!d || !panel.current) return;
      const velocity = d.dy / Math.max(1, Date.now() - d.t);
      if (d.dy > 120 || (d.dy > 30 && velocity > 0.5)) {
        panel.current.style.transition = 'transform .2s ease-in';
        panel.current.style.transform = 'translateY(100%)';
        setTimeout(onClose, 200);
      } else {
        panel.current.style.transition = 'transform .2s ease-out';
        panel.current.style.transform = '';
      }
    },
    onPointerCancel() {
      drag.current = null;
      if (panel.current) panel.current.style.transform = '';
    },
  };

  return createPortal(
    <div className={`overlay${wide ? ' wide' : ''}${closing ? ' closing' : ''}`} onClick={close}>
      <div
        ref={panel}
        className={`panel${small ? ' small' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {!wide && (
          <div className="grab" {...dragProps}>
            <span />
          </div>
        )}
        {children({ close, dragProps, wide })}
      </div>
    </div>,
    document.body,
  );
}
