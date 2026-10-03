import { syncNow } from '../data/sync';
import { usePendingCount } from '../hooks/useData';
import { useSession } from '../hooks/useSession';
import { ConfirmDialog } from './Dialog';

/** Confirma el cierre de sesión y avisa si hay cambios aún sin subir. */
export function LogoutDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useSession();
  const pending = usePendingCount();
  return (
    <ConfirmDialog
      title="¿Cerrar sesión?"
      confirmLabel="Cerrar sesión"
      danger
      onClose={onClose}
      onConfirm={async () => {
        await syncNow();
        await logout();
      }}
    >
      {pending > 0 ? (
        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
          Tienes {pending} {pending === 1 ? 'cambio' : 'cambios'} sin sincronizar. Si cierras sesión sin conexión, se perderán.
        </span>
      ) : (
        'Tus registros quedan guardados en tu cuenta. Se borrarán de este dispositivo.'
      )}
    </ConfirmDialog>
  );
}
