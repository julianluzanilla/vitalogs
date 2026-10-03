import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';

interface Props {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/** Diálogo de confirmación (hoja en iPhone, modal en PC). */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancelar', danger, confirmDisabled, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={onClose} small label={title}>
      {({ close, dragProps }) => (
        <>
          <div className="panel-head draggable" {...dragProps}>
            <div className="panel-title">
              <span>{title}</span>
            </div>
          </div>
          {children && <div className="dialog-body">{children}</div>}
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={close}>
              {cancelLabel}
            </button>
            <button
              className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`}
              disabled={busy || confirmDisabled}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  close();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
