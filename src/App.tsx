import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';
import { MainLayout } from './components/layout/MainLayout';
import { ConfigLayout } from './pages/config/ConfigLayout';

// Pages - Lazy loaded
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SsoLoginPage = lazy(() => import('./pages/SsoLoginPage'));
const SsoStatusPage = lazy(() => import('./pages/SsoStatusPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SystemConfigPage = lazy(() => import('./pages/config/SystemConfigPage'));
const TicketsCalendarPage = lazy(() => import('./pages/TicketsCalendarPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
import { PermissionGuard } from './components/auth/PermissionGuard';

const consoleUrl = import.meta.env.VITE_CONSOLE_URL || (import.meta.env.PROD ? 'https://console.siatc.cloud' : 'http://localhost:3008');

const ExternalRedirect = ({ url }: { url: string }) => {
  React.useEffect(() => {
    window.location.replace(url);
  }, [url]);
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Redirigiendo a la administración central...</p>
      </div>
    </div>
  );
};

const LoadingFallback = () => (
    <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
            <img src="/Logo.png" alt="Gestión Técnica Logo" className="w-16 h-16 object-contain animate-pulse" />
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium animate-pulse">Cargando Gestión Técnica...</p>
        </div>
    </div>
);

function HomeRedirect() {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  if (hasPermission('tec.tickets.view')) {
    return <Navigate to="/tickets" replace />;
  }
  if (hasPermission('tec.config.access')) {
    return <Navigate to="/config/parameters" replace />;
  }
  return <Navigate to="/profile" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DialogProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/sso-login" element={<SsoLoginPage />} />
              <Route path="/sso-status" element={<SsoStatusPage />} />

              <Route element={<MainLayout />}>
                <Route path="/profile" element={<ProfilePage />} />
                
                <Route path="tickets" element={
                  <PermissionGuard permission="tec.tickets.view" asRoute>
                    <TicketsCalendarPage />
                  </PermissionGuard>
                } />

                {/*
                  Panel de indicadores. Existia completo —pagina, servicio y las 4 rutas del
                  backend— pero nunca estuvo enrutado, asi que no lo veia nadie. Diego pidio
                  activarlo el 2026-08-19 para revisar el trabajo de Oscar.

                  Se protege con `tec.dashboard.view`, que HOY no tiene ningun rol: como
                  `hasPermission` y `checkPermission` dan paso a los administradores sin mirar la
                  lista, el efecto es "solo administradores" sin cablear el rol en el codigo. Para
                  abrirlo a otro rol basta con concederle el permiso en Console.
                */}
                <Route path="dashboard" element={
                  <PermissionGuard permission="tec.dashboard.view" asRoute>
                    <DashboardPage />
                  </PermissionGuard>
                } />

                <Route path="payments" element={
                  <PermissionGuard permission="tec.payments.view" asRoute>
                    <PaymentsPage />
                  </PermissionGuard>
                } />

                <Route path="/config" element={
                  <PermissionGuard permission="tec.config.access" asRoute>
                    <ConfigLayout />
                  </PermissionGuard>
                }>
                  <Route index element={<Navigate to="parameters" replace />} />
                  <Route path="parameters" element={
                    <PermissionGuard permission="tec.config.parameters" asRoute>
                      <SystemConfigPage />
                    </PermissionGuard>
                  } />
                  <Route path="audit" element={
                    <PermissionGuard permission="tec.config.audit" asRoute>
                      <ExternalRedirect url={`${consoleUrl}/audit`} />
                    </PermissionGuard>
                  } />
                </Route>
                
                <Route path="/" element={<HomeRedirect />} />
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </DialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
