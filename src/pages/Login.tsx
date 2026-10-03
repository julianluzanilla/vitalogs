import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../data/api';
import { Icon, Wordmark } from '../components/Icon';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';

/** Marco común de las pantallas de acceso (usuario y admin). */
export function AuthFrame({ subtitle, children, badge }: { subtitle: string; children: ReactNode; badge?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <div className="login">
      <div className="login-top">
        <button className="icon-btn" aria-label="Cambiar modo" onClick={toggle}>
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
      </div>
      <div className="login-main">
        <div className="login-col">
          <div className="login-brand">
            <img className="login-logo" src="/icons/logo-mark.svg" alt="" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Wordmark className="login-word" />
                {badge && <span className="admin-badge">{badge}</span>}
              </div>
              <div className="login-sub">{subtitle}</div>
            </div>
          </div>
          {children}
          <div className="login-foot">vitalogs.luzaron.uk</div>
        </div>
      </div>
    </div>
  );
}

export function LoginForm({ onSubmit }: { onSubmit: (u: string, p: string) => Promise<void> }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!u.trim() || !p) return setErr('Ingresa usuario y contraseña.');
    setBusy(true);
    try {
      await onSubmit(u.trim(), p);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'No hay conexión. Inténtalo de nuevo.');
      setP('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="login-input">
        <Icon name="user" />
        <input
          value={u}
          onChange={(e) => (setU(e.target.value), setErr(''))}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Usuario"
          aria-label="Usuario"
        />
      </label>
      <label className="login-input">
        <Icon name="lock" />
        <input
          type="password"
          value={p}
          onChange={(e) => (setP(e.target.value), setErr(''))}
          autoComplete="current-password"
          placeholder="Contraseña"
          aria-label="Contraseña"
        />
      </label>
      {err && <div className="login-error">{err}</div>}
      <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 8 }} disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export function Login() {
  const { login, session } = useSession();
  const expired = session.status === 'anon' && session.expired;
  return (
    <AuthFrame subtitle="Tu registro personal de salud.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {expired && <div className="login-note">Tu sesión expiró. Vuelve a entrar; tus registros sin sincronizar se conservan.</div>}
        <LoginForm onSubmit={login} />
      </div>
    </AuthFrame>
  );
}

export function PasswordForm({
  onSubmit,
  minLength,
  submitLabel,
  extra,
}: {
  onSubmit: (current: string, next: string) => Promise<void>;
  minLength: number;
  submitLabel: string;
  extra?: ReactNode;
}) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cur || !next) return setErr('Completa todos los campos.');
    if (next.length < minLength) return setErr(`La nueva contraseña debe tener al menos ${minLength} caracteres.`);
    if (next !== again) return setErr('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await onSubmit(cur, next);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'No hay conexión. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, autoComplete: string) => (
    <label className="login-input">
      <Icon name="lock" />
      <input type="password" value={value} placeholder={placeholder} aria-label={placeholder} autoComplete={autoComplete} onChange={(e) => (set(e.target.value), setErr(''))} />
    </label>
  );

  return (
    <form className="login-form" onSubmit={submit}>
      {field(cur, setCur, 'Contraseña actual', 'current-password')}
      {field(next, setNext, 'Nueva contraseña', 'new-password')}
      {field(again, setAgain, 'Repite la nueva contraseña', 'new-password')}
      {err && <div className="login-error">{err}</div>}
      <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 8 }} disabled={busy}>
        {busy ? 'Guardando…' : submitLabel}
      </button>
      {extra}
    </form>
  );
}

export function ChangePassword() {
  const { changePassword, logout, session } = useSession();
  const name = session.status === 'authed' ? session.me.displayName.split(' ')[0] : '';
  return (
    <AuthFrame subtitle={`Hola${name ? `, ${name}` : ''}. Crea tu propia contraseña para continuar (mínimo 8 caracteres).`}>
      <PasswordForm
        minLength={8}
        submitLabel="Guardar y continuar"
        onSubmit={changePassword}
        extra={
          <button type="button" className="link-btn" style={{ alignSelf: 'center', marginTop: 4 }} onClick={() => void logout()}>
            Salir
          </button>
        }
      />
    </AuthFrame>
  );
}
