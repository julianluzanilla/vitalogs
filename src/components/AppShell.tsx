import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { Entry, EntryType } from '../../shared/model';
import { getSyncState, subscribeSync } from '../data/sync';
import { usePendingCount, useProfile } from '../hooks/useData';
import { useMe } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { useWide } from '../hooks/useWide';
import { blankForm, formFromEntry, type FormState } from '../lib/form';
import { EntrySheet } from './EntrySheet';
import { Icon, Wordmark } from './Icon';
import { LogoutDialog } from './LogoutDialog';

interface EntryOpener {
  openNew: (type: EntryType | null) => void;
  openEdit: (e: Entry) => void;
}

const OpenerCtx = createContext<EntryOpener>({ openNew: () => {}, openEdit: () => {} });
export const useEntryOpener = () => useContext(OpenerCtx);

const TABS = [
  { to: '/', label: 'Hoy', icon: 'home' },
  { to: '/historial', label: 'Historial', icon: 'clock' },
  { to: '/reportes', label: 'Reportes', icon: 'chart' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
];

/** Nombre que se muestra: el de reportes si existe, si no el que puso el admin. */
export function useDisplayName(): string {
  const me = useMe();
  const profile = useProfile();
  return profile?.reportName || me.displayName;
}

function SyncPill() {
  const state = useSyncExternalStore(subscribeSync, getSyncState);
  const pending = usePendingCount();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  const offline = !online || state === 'offline';
  if (!offline && state !== 'error' && pending === 0) return null;
  const label = offline ? `Sin conexión${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}` : state === 'error' ? 'Error al sincronizar' : `${pending} por sincronizar`;
  return (
    <span className={`sync-pill${state === 'error' ? ' error' : ''}`} role="status">
      {label}
    </span>
  );
}

export function AppShell() {
  const wide = useWide();
  const { dark, toggle } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const name = useDisplayName();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [form, setForm] = useState<{ state: FormState; key: number } | null>(null);
  const initial = (name || '?').charAt(0).toUpperCase();
  const themeIcon = dark ? 'sun' : 'moon';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const openNew = useCallback((type: EntryType | null) => setForm({ state: blankForm(type), key: Date.now() }), []);
  const openEdit = useCallback((e: Entry) => setForm({ state: formFromEntry(e), key: Date.now() }), []);

  const tab = (t: (typeof TABS)[number], cls: string) => (
    <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `${cls}${isActive ? ' active' : ''}`}>
      <Icon name={t.icon} />
      {t.label}
    </NavLink>
  );

  return (
    <OpenerCtx.Provider value={{ openNew, openEdit }}>
      <div className={`shell ${wide ? 'wide' : 'narrow'}`}>
        {wide && (
          <aside className="sidebar">
            <div className="sidebar-brand">
              <img src="/icons/logo-mark.svg" alt="" />
              <Wordmark />
            </div>
            <button className="btn btn-primary" onClick={() => openNew(null)}>
              <Icon name="plus" size={18} />
              Nuevo registro
            </button>
            <nav className="nav">{TABS.map((t) => tab(t, 'nav-item'))}</nav>
            <div className="sidebar-bottom">
              <div style={{ padding: '0 10px' }}>
                <SyncPill />
              </div>
              <button className="nav-item" onClick={toggle}>
                <Icon name={themeIcon} />
                {dark ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <div className="user-card">
                <div className="avatar">{initial}</div>
                <div className="name">{name}</div>
                <button className="icon-btn ghost" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => setLoggingOut(true)}>
                  <Icon name="logout" size={18} />
                </button>
              </div>
            </div>
          </aside>
        )}

        <main className="main">
          {!wide && (
            <header className="topbar">
              <img src="/icons/logo-mark.svg" alt="" />
              <Wordmark />
              <SyncPill />
              <button className="icon-btn" aria-label="Cambiar modo" onClick={toggle}>
                <Icon name={themeIcon} size={19} />
              </button>
              <button className="avatar" aria-label="Perfil" onClick={() => navigate('/perfil')}>
                {initial}
              </button>
            </header>
          )}
          <div className="content">
            <Outlet />
          </div>
        </main>

        {!wide && (
          <nav className="tabbar">
            {TABS.slice(0, 2).map((t) => tab(t, 'tab'))}
            <div className="tab-plus">
              <button aria-label="Nuevo registro" onClick={() => openNew(null)}>
                <Icon name="plus" />
              </button>
            </div>
            {TABS.slice(2).map((t) => tab(t, 'tab'))}
          </nav>
        )}
      </div>
      {form && <EntrySheet key={form.key} initial={form.state} onClose={() => setForm(null)} />}
      {loggingOut && <LogoutDialog onClose={() => setLoggingOut(false)} />}
    </OpenerCtx.Provider>
  );
}
