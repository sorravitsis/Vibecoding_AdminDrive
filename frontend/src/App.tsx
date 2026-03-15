import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import './styles/global.css';

import Files from './pages/Files';
import RecycleBin from './pages/RecycleBin';
import Login from './pages/Login';
import Activity from './pages/Activity';
import UsersManagement from './pages/UsersManagement';

// Mock Pages for now
const Dashboard = () => <div className="page-content">Dashboard Content</div>;

const ProtectedLayout = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && !roles.includes(user?.role || '')) return <Navigate to="/" />;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedLayout>
          <Dashboard />
        </ProtectedLayout>
      } />
      
      <Route path="/files" element={
        <ProtectedLayout>
          <Files />
        </ProtectedLayout>
      } />

      <Route path="/recycle-bin" element={
        <ProtectedLayout>
          <RecycleBin />
        </ProtectedLayout>
      } />

      <Route path="/activity" element={
        <ProtectedLayout>
          <Activity />
        </ProtectedLayout>
      } />

      <Route path="/admin/users" element={
        <ProtectedLayout roles={['admin']}>
          <UsersManagement />
        </ProtectedLayout>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
