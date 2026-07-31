import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import Shops from './pages/Shops';
import Tenants from './pages/Tenants';
import Sales from './pages/Sales';
import Payments from './pages/Payments';
import Ledger from './pages/Ledger';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import Summary from './pages/Summary';
import Contractor from './pages/Contractor';
import ProjectsDashboard from './pages/ProjectsDashboard';
import { supabase } from './supabaseClient';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { purgeOrphanedData } from './utils/autoCleanup';

function AppContent({ currentUser, handleLogout }) {
  const { activeProject } = useProject();

  // Auto-delete orphaned data whenever a project is loaded
  useEffect(() => {
    if (activeProject?.id) {
      purgeOrphanedData(activeProject.id);
    }
  }, [activeProject?.id]);

  return (
    <BrowserRouter>
      <Layout currentUser={currentUser} onLogout={handleLogout}>
        {!activeProject ? (
          <Routes>
            <Route path="/" element={<ProjectsDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/shops" element={<Shops currentUser={currentUser} />} />
            <Route path="/tenants" element={<Tenants currentUser={currentUser} />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/payments" element={<Payments currentUser={currentUser} />} />
            <Route path="/contractor" element={<Contractor />} />
            <Route path="/summary" element={<Summary />} />
            
            {currentUser.isAdmin && (
              <Route path="/admin" element={<AdminPanel />} />
            )}
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Layout>
    </BrowserRouter>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const checkUserStatus = async (user) => {
    if (!user) {
      setCurrentUser(null);
      setIsApproved(false);
      return;
    }
    
    // Auto approve root admin
    if (user.email === 'talhanaveed89@gmail.com') {
      user.isAdmin = true;
      setCurrentUser(user);
      setIsApproved(true);
      return;
    }

    const { data } = await supabase.from('users').select('is_approved, is_admin').eq('username', user.email).single();
    user.isAdmin = data?.is_admin || false;
    setCurrentUser(user);
    setIsApproved(data?.is_approved || false);
  };

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await checkUserStatus(session?.user);
      setIsInitializing(false);
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await checkUserStatus(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg-app)' }}>Loading...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  if (!isApproved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg-app)', textAlign: 'center', padding: '2rem' }}>
        <div className="card" style={{ maxWidth: '400px', padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-warning-text)' }}>Pending Approval</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
            Your account is currently locked. Please contact the administrator to grant you access.
          </p>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center' }}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider>
      <AppContent currentUser={currentUser} handleLogout={handleLogout} />
    </ProjectProvider>
  );
}

export default App;
