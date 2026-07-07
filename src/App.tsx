import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const AuditLogPage = lazy(() => import('./pages/config/AuditLogPage'));
const TicketsCalendarPage = lazy(() => import('./pages/TicketsCalendarPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
import { PermissionGuard } from './components/auth/PermissionGuard';

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
                      <AuditLogPage />
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
