import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Me } from '../../shared/model';
import { ApiError, NetworkError, api } from '../data/api';
import { getMe, setKV, wipeLocal } from '../data/db';
import { enableSync, setUnauthorizedHandler, startAutoSync } from '../data/sync';

export type Session =
  | { status: 'loading' }
  | { status: 'anon'; expired?: boolean }
  | { status: 'authed'; me: Me };

interface SessionCtx {
  session: Session;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const Ctx = createContext<SessionCtx>(null as unknown as SessionCtx);

/** Si en este dispositivo había datos de otra persona, se borran antes de continuar. */
async function adopt(me: Me) {
  const cached = await getMe();
  if (cached && cached.id !== me.id) await wipeLocal();
  await setKV('me', me);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await getMe();
      try {
        const { me } = await api<{ me: Me }>('/auth/me');
        await adopt(me);
        if (alive) setSession({ status: 'authed', me });
      } catch (err) {
        if (!alive) return;
        // Sin conexión: se entra con la última sesión conocida y se sincroniza al volver la red.
        if (err instanceof NetworkError && cached && !cached.mustChangePassword) setSession({ status: 'authed', me: cached });
        else setSession({ status: 'anon', expired: err instanceof ApiError && !!cached });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ready = session.status === 'authed' && !session.me.mustChangePassword;
  useEffect(() => {
    if (!ready) return;
    enableSync(true);
    setUnauthorizedHandler(() => setSession({ status: 'anon', expired: true }));
    const stop = startAutoSync();
    return () => {
      stop();
      enableSync(false);
      setUnauthorizedHandler(null);
    };
  }, [ready]);

  const login = useCallback(async (username: string, password: string) => {
    const { me } = await api<{ me: Me }>('/auth/login', { body: { username, password } });
    await adopt(me);
    setSession({ status: 'authed', me });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { body: {} });
    } catch {
      /* sin conexión: la cookie vencerá sola */
    }
    enableSync(false);
    await wipeLocal();
    setSession({ status: 'anon' });
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const { me } = await api<{ me: Me }>('/auth/password', { body: { current, next } });
    await setKV('me', me);
    setSession({ status: 'authed', me });
  }, []);

  return <Ctx.Provider value={{ session, login, logout, changePassword }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Usuario autenticado (solo usar dentro de rutas protegidas). */
export function useMe(): Me {
  const { session } = useSession();
  if (session.status !== 'authed') throw new Error('Sin sesión');
  return session.me;
}

