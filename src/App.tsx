import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { SessionProvider, useSession } from './hooks/useSession';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { Historial } from './pages/Historial';
import { Hoy } from './pages/Hoy';
import { ChangePassword, Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Reportes } from './pages/Reportes';

// La consola de administración va en un paquete aparte y no comparte sesión con la app.
const AdminApp = lazy(() => import('./admin/AdminApp'));

/** Se monta cuando la primera pantalla ya tiene sus datos: desvanece la pantalla de carga de index.html. */
function Ready() {
  useEffect(() => {
    const loaded = document.readyState === 'complete' ? null : new Promise((r) => window.addEventListener('load', r, { once: true }));
    void Promise.all([document.fonts.ready, loaded]).then(() => {
      const boot = document.getElementById('boot');
      if (!boot) return;
      boot.classList.add('out');
      setTimeout(() => boot.remove(), 1000);
    });
  }, []);
  return null;
}

function UserApp() {
  const { session } = useSession();
  if (session.status === 'loading') return null;
  return (
    <>
      <Ready />
      <UserScreen />
    </>
  );
}

function UserScreen() {
  const { session } = useSession();
  if (session.status !== 'authed') return <Login />;
  if (session.me.mustChangePassword) return <ChangePassword />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Hoy />} />
        <Route path="historial" element={<Historial />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={null}>
                  <Ready />
                  <AdminApp />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <SessionProvider>
                  <UserApp />
                </SessionProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
