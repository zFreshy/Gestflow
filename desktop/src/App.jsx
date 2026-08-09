import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { DashboardTemplate } from './components/templates/DashboardTemplate';
import { LoginPage } from './components/pages/LoginPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { SalePage } from './components/pages/SalePage';
import { ProductsPage } from './components/pages/ProductsPage';
import { StockPage } from './components/pages/StockPage';
import { SalesHistoryPage } from './components/pages/SalesHistoryPage';
import { StoreCreditPage } from './components/pages/StoreCreditPage';
import { EmployeeProfilesPage } from './components/pages/EmployeeProfilesPage';
import { EmployeeCreditPage } from './components/pages/EmployeeCreditPage';

/**
 * Rota que só o administrador abre. Não é segurança — é o mesmo cuidado do
 * menu, para o funcionário não cair numa tela de financeiro digitando a URL ou
 * voltando no histórico.
 */
function AdminRoute({ children }) {
    const { isAdmin } = useProfile();
    return isAdmin ? children : <Navigate to="/venda" replace />;
}

/** O contrário: telas que só existem dentro de um perfil de funcionário. */
function EmployeeRoute({ children }) {
    const { isEmployee } = useProfile();
    return isEmployee ? children : <Navigate to="/creditos" replace />;
}

function AppContent() {
    const { user } = useAuth();
    const { isAdmin } = useProfile();

    if (!user) return <LoginPage />;

    return (
        <DashboardTemplate>
            <Routes>
                <Route
                    path="/"
                    element={isAdmin ? <DashboardPage /> : <Navigate to="/venda" replace />}
                />
                <Route path="/venda" element={<SalePage />} />
                <Route path="/produtos" element={<ProductsPage />} />
                <Route path="/estoque" element={<AdminRoute><StockPage /></AdminRoute>} />
                <Route path="/fiado" element={<StoreCreditPage />} />
                <Route path="/vendas" element={<AdminRoute><SalesHistoryPage /></AdminRoute>} />

                <Route
                    path="/meu-credito"
                    element={<EmployeeRoute><EmployeeCreditPage /></EmployeeRoute>}
                />
                <Route
                    path="/creditos"
                    element={<AdminRoute><EmployeeCreditPage /></AdminRoute>}
                />
                <Route
                    path="/perfis"
                    element={<AdminRoute><EmployeeProfilesPage /></AdminRoute>}
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </DashboardTemplate>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <ProfileProvider>
                <AppContent />
            </ProfileProvider>
        </AuthProvider>
    );
}
