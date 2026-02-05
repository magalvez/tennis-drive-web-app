import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ConfigPage from './pages/admin/ConfigPage';
import DashboardPage from './pages/admin/DashboardPage';
import ManageAdminsPage from './pages/admin/ManageAdminsPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import PlayersPage from './pages/admin/PlayersPage';
import CreateTournamentPage from './pages/admin/tournaments/CreateTournamentPage';
import EditTournamentPage from './pages/admin/tournaments/EditTournamentPage';
import TournamentDetailPage from './pages/admin/tournaments/TournamentDetailPage';
import TournamentListPage from './pages/admin/tournaments/TournamentListPage';
import TournamentMatchesPage from './pages/admin/tournaments/TournamentMatchesPage';
import TournamentPlayersPage from './pages/admin/tournaments/TournamentPlayersPage';
import LoginPage from './pages/LoginPage';

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tennis-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tennis-green"></div>
      </div>
    );
  }

  if (!user || role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout />
                </ProtectedAdminRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="tournaments" element={<TournamentListPage />} />
              <Route path="tournaments/create" element={<CreateTournamentPage />} />
              <Route path="tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="tournaments/:id/edit" element={<EditTournamentPage />} />
              <Route path="tournaments/:id/matches" element={<TournamentMatchesPage />} />
              <Route path="tournaments/:id/players" element={<TournamentPlayersPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="users/admins" element={<ManageAdminsPage />} />
              <Route path="config" element={<ConfigPage />} />
              {/* Future admin routes will go here */}
            </Route>
            <Route path="/" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
