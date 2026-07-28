import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Receipt, CreditCard, FileText, ShieldAlert, LogOut, Menu, X, PieChart, Plus, Folder } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

export default function Layout({ children, currentUser, onLogout }) {
  const { projects, activeProject, changeActiveProject, createProject, loading } = useProject();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim());
      setIsCreatingProject(false);
      setNewProjectName('');
    } catch (err) {
      alert("Failed to create project.");
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/shops', label: 'Shops', icon: Store },
    { path: '/tenants', label: 'Tenants', icon: Users },
    { path: '/ledger', label: 'Ledgers', icon: FileText },
    { path: '/sales', label: 'Sales & Allocations', icon: Receipt },
    { path: '/payments', label: 'Payments', icon: CreditCard },
    { path: '/summary', label: 'Summary', icon: PieChart },
  ];

  if (currentUser?.email === 'talhanaveed89@gmail.com') {
    navItems.push({ path: '/admin', label: 'Admin Panel', icon: ShieldAlert });
  }

  return (
    <div className="app-container">
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Store size={24} color="#f59e0b" />
            <span className="sidebar-title">PlazaManager</span>
          </div>
          <button className="mobile-only sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} color="#fff" />
          </button>
        </div>
        
        {/* Project Selector */}
        <div style={{ padding: '0 1.25rem 1rem 1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Active Project</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select 
              className="input-field" 
              style={{ padding: '0.5rem', fontSize: '0.875rem' }}
              value={activeProject?.id || ''} 
              onChange={(e) => changeActiveProject(e.target.value)}
              disabled={loading}
            >
              <option value="">-- All Projects --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem' }} 
              onClick={() => setIsCreatingProject(true)}
              title="Create New Project"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {activeProject && (
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="mobile-only menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="topbar-title">Plaza Management System</h2>
          </div>
          <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
              {currentUser?.email || 'User'}
            </span>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {currentUser?.email?.charAt(0) || 'U'}
            </div>
            <button 
              onClick={onLogout}
              className="btn btn-secondary logout-btn" 
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}
              title="Logout"
            >
              <LogOut size={16} />
              <span className="logout-text" style={{ fontSize: '0.875rem' }}>Logout</span>
            </button>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>

      {/* Create Project Modal */}
      {isCreatingProject && (
        <div className="modal-overlay" onClick={() => setIsCreatingProject(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button className="icon-btn" onClick={() => setIsCreatingProject(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Skyline Plaza" 
                  required 
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreatingProject(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newProjectName.trim()}>Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
