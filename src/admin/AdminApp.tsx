import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, NetworkError, api } from '../data/api';
import { ConfirmDialog } from '../components/Dialog';
import { Icon, Wordmark } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { copyText } from '../lib/clipboard';
import { AuthFrame, LoginForm, PasswordForm } from '../pages/Login';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  disabled: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

type AdminState = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; username: string };

const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca');

/**
 * Consola de administración: solo gestiona cuentas.
 * La API de admin no tiene ningún endpoint que lea registros de salud.
 */
export default function AdminApp() {
  const [state, setState] = useState<AdminState>({ status: 'loading' });

  useEffect(() => {
    document.title = 'VitaLogs · Administración';
    api<{ admin: { username: string } }>('/admin/me').then(
      ({ admin }) => setState({ status: 'authed', username: admin.username }),
      () => setState({ status: 'anon' }),
    );
  }, []);

  if (state.status === 'loading') return null;
  if (state.status === 'anon')
    return (
      <AuthFrame subtitle="Gestión de cuentas de usuario." badge="Admin">
        <LoginForm
          onSubmit={async (username, password) => {
            const { admin } = await api<{ admin: { username: string } }>('/admin/login', { body: { username, password } });
            setState({ status: 'authed', username: admin.username });
          }}
        />
      </AuthFrame>
    );
  return <AdminUsers username={state.username} onLogout={() => setState({ status: 'anon' })} />;
}

function AdminUsers({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ user: AdminUser; password: string; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'delete' | 'disable'; user: AdminUser } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) return onLogout();
      toast(err instanceof ApiError ? err.message : err instanceof NetworkError ? 'Sin conexión' : 'Error');
    },
    [onLogout, toast],
  );

  const load = useCallback(() => {
    api<{ users: AdminUser[] }>('/admin/users').then(({ users }) => setUsers(users), handle);
  }, [handle]);

  useEffect(load, [load]);

  const patch = async (u: AdminUser, body: Record<string, unknown>) => {
    try {
      const res = await api<{ user: AdminUser; tempPassword?: string }>(`/admin/users/${u.id}`, { method: 'PATCH', body });
      setUsers((list) => list?.map((x) => (x.id === u.id ? res.user : x)) ?? null);
      return res;
    } catch (err) {
      handle(err);
    }
  };

  const logout = async () => {
    try {
      await api('/admin/logout', { body: {} });
    } finally {
      onLogout();
    }
  };

  return (
    <div className="admin-wrap">
      <header className="admin-top">
        <img src="/icons/logo-mark.svg" alt="" />
        <Wordmark />
        <span className="admin-badge">Admin</span>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Cambiar modo" onClick={toggle}>
          <Icon name={dark ? 'sun' : 'moon'} size={19} />
        </button>
        <button className="icon-btn" aria-label="Cambiar contraseña de administrador" title="Cambiar mi contraseña" onClick={() => setPwOpen(true)}>
          <Icon name="lock" size={19} />
        </button>
        <button className="icon-btn" aria-label="Cerrar sesión" title={`Cerrar sesión (${username})`} onClick={logout}>
          <Icon name="logout" size={19} />
        </button>
      </header>

      <div className="admin-content">
        <div className="report-head">
          <div className="page-head">
            <h1 className="page-title">Usuarios</h1>
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>{users ? `${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'}` : 'Cargando…'}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            Nuevo usuario
          </button>
        </div>

        <div className="admin-note">
          <Icon name="lock" size={18} />
          <span>Desde aquí solo se gestionan cuentas. Los registros de salud son privados de cada usuario y no son visibles para el administrador.</span>
        </div>

        {users && !users.length && <div className="empty">Aún no hay usuarios. Crea el primero con “Nuevo usuario”.</div>}
        {users && users.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {users.map((u) => (
              <div className="user-row" key={u.id}>
                <div className="avatar">{u.displayName.charAt(0).toUpperCase()}</div>
                <div className="who">
                  <b>{u.displayName}</b>
                  <small>
                    @{u.username} · Último acceso: {fmt(u.lastLoginAt)}
                  </small>
                  <span style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {u.disabled ? (
                      <span className="tag off">Deshabilitada</span>
                    ) : u.mustChangePassword ? (
                      <span className="tag warn">Contraseña temporal</span>
                    ) : (
                      <span className="tag ok">Activa</span>
                    )}
                  </span>
                </div>
                <div className="actions">
                  <button className="btn btn-secondary" onClick={() => setConfirm({ kind: 'reset', user: u })}>
                    Restablecer contraseña
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => (u.disabled ? void patch(u, { disabled: false }).then((r) => r && toast('Cuenta habilitada')) : setConfirm({ kind: 'disable', user: u }))}
                  >
                    {u.disabled ? 'Habilitar' : 'Deshabilitar'}
                  </button>
                  <button className="btn btn-danger" aria-label={`Eliminar ${u.username}`} onClick={() => (setTyped(''), setConfirm({ kind: 'delete', user: u }))}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateUserSheet
          onClose={() => setCreating(false)}
          onCreated={(user, password) => {
            setUsers((list) => [...(list || []), user]);
            setSecret({ user, password, isNew: true });
          }}
          onError={handle}
        />
      )}

      {secret && <TempPasswordSheet {...secret} onClose={() => setSecret(null)} />}

      {confirm?.kind === 'reset' && (
        <ConfirmDialog
          title="¿Restablecer contraseña?"
          confirmLabel="Restablecer"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const res = await patch(confirm.user, { resetPassword: true });
            if (res?.tempPassword) setSecret({ user: res.user, password: res.tempPassword, isNew: false });
          }}
        >
          Se generará una contraseña temporal para <b>{confirm.user.displayName}</b> y se cerrarán sus sesiones abiertas. Sus registros no se modifican.
        </ConfirmDialog>
      )}

      {confirm?.kind === 'disable' && (
        <ConfirmDialog
          title="¿Deshabilitar cuenta?"
          confirmLabel="Deshabilitar"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (await patch(confirm.user, { disabled: true })) toast('Cuenta deshabilitada');
          }}
        >
          <b>{confirm.user.displayName}</b> no podrá entrar hasta que la habilites de nuevo. Sus registros se conservan.
        </ConfirmDialog>
      )}

      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title="¿Eliminar cuenta?"
          confirmLabel="Eliminar para siempre"
          danger
          confirmDisabled={typed.trim().toLowerCase() !== confirm.user.username}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await api(`/admin/users/${confirm.user.id}`, { method: 'DELETE', body: {} });
              setUsers((list) => list?.filter((x) => x.id !== confirm.user.id) ?? null);
              toast('Cuenta eliminada');
            } catch (err) {
              handle(err);
            }
          }}
        >
          <span>
            Se eliminarán la cuenta de <b>{confirm.user.displayName}</b> y <b>todos sus registros</b>. No se puede deshacer.
          </span>
          <label className="field">
            <span className="label">Escribe “{confirm.user.username}” para confirmar</span>
            <input className="input" value={typed} autoCapitalize="none" autoCorrect="off" onChange={(e) => setTyped(e.target.value)} />
          </label>
        </ConfirmDialog>
      )}

      {pwOpen && (
        <Sheet onClose={() => setPwOpen(false)} small label="Contraseña de administrador">
          {({ close, dragProps }) => (
            <>
              <div className="panel-head draggable" {...dragProps}>
                <div className="panel-title">
                  <span>Contraseña de administrador</span>
                </div>
                <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
                  <Icon name="x" />
                </button>
              </div>
              <div className="dialog-body" style={{ paddingBottom: 'calc(22px + var(--sab))' }}>
                <PasswordForm
                  minLength={10}
                  submitLabel="Guardar contraseña"
                  onSubmit={async (current, next) => {
                    await api('/admin/password', { body: { current, next } });
                    toast('Contraseña actualizada');
                    close();
                  }}
                />
              </div>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}

function CreateUserSheet({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (u: AdminUser, password: string) => void; onError: (e: unknown) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={onClose} small label="Nuevo usuario">
      {({ close, dragProps }) => {
        const submit = async (e: FormEvent) => {
          e.preventDefault();
          setBusy(true);
          try {
            const res = await api<{ user: AdminUser; tempPassword: string }>('/admin/users', { body: { username, displayName } });
            onCreated(res.user, res.tempPassword);
            close();
          } catch (x) {
            if (x instanceof ApiError && x.status !== 401) setErr(x.message);
            else onError(x);
          } finally {
            setBusy(false);
          }
        };
        return (
          <>
            <div className="panel-head draggable" {...dragProps}>
              <div className="panel-title">
                <span>Nuevo usuario</span>
              </div>
              <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
                <Icon name="x" />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="dialog-body">
                <label className="field">
                  <span className="label">Nombre de la persona</span>
                  <input className="input" value={displayName} maxLength={80} placeholder="p. ej. María López" onChange={(e) => (setDisplayName(e.target.value), setErr(''))} />
                </label>
                <label className="field">
                  <span className="label">Usuario para entrar</span>
                  <input
                    className="input"
                    value={username}
                    maxLength={32}
                    placeholder="p. ej. maria"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => (setUsername(e.target.value.toLowerCase().replace(/\s/g, '')), setErr(''))}
                  />
                  <span className="hint" style={{ fontSize: 13 }}>
                    3–32 caracteres: letras, números, punto o guion.
                  </span>
                </label>
                {err && <div className="error-text">{err}</div>}
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || !username || !displayName.trim()}>
                  {busy ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </>
        );
      }}
    </Sheet>
  );
}

function TempPasswordSheet({ user, password, isNew, onClose }: { user: AdminUser; password: string; isNew: boolean; onClose: () => void }) {
  const toast = useToast();
  const text = `VitaLogs — https://vitalogs.luzaron.uk\nUsuario: ${user.username}\nContraseña temporal: ${password}\n(Te pedirá crear tu propia contraseña al entrar.)`;
  const copy = async (value: string, msg: string) => toast((await copyText(value)) ? msg : 'No se pudo copiar; mantén presionado el texto para copiarlo');
  return (
    <Sheet onClose={onClose} small label="Contraseña temporal">
      {({ close, dragProps }) => (
        <>
          <div className="panel-head draggable" {...dragProps}>
            <div className="panel-title">
              <span>{isNew ? 'Usuario creado' : 'Contraseña restablecida'}</span>
            </div>
            <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
              <Icon name="x" />
            </button>
          </div>
          <div className="dialog-body">
            <span>
              Comparte estos datos con <b>{user.displayName}</b>. La contraseña temporal no se volverá a mostrar; al entrar se le pedirá crear una propia.
            </span>
            <div className="field">
              <span className="label">Usuario</span>
              <div className="temp-pass" style={{ fontSize: 18 }}>
                <span>{user.username}</span>
                <button className="icon-btn ghost" aria-label="Copiar usuario" title="Copiar usuario" onClick={() => copy(user.username, 'Usuario copiado')}>
                  <Icon name="copy" size={18} />
                </button>
              </div>
            </div>
            <div className="field">
              <span className="label">Contraseña temporal</span>
              <div className="temp-pass">
                <span>{password}</span>
                <button className="icon-btn ghost" aria-label="Copiar contraseña" title="Copiar contraseña" onClick={() => copy(password, 'Contraseña copiada')}>
                  <Icon name="copy" size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => copy(text, 'Mensaje copiado')}>
              <Icon name="copy" size={18} />
              Copiar mensaje
            </button>
            {typeof navigator.share === 'function' ? (
              <button className="btn btn-primary" onClick={() => navigator.share({ title: 'Acceso a VitaLogs', text }).catch(() => {})}>
                <Icon name="share" size={18} />
                Compartir
              </button>
            ) : (
              <button className="btn btn-primary" onClick={close}>
                Listo
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
