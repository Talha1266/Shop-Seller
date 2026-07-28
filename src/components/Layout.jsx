import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Receipt, CreditCard, FileText, ShieldAlert, LogOut } from 'lucide-react';

export default function Layout({ children, currentUser, onLogout }) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/shops', label: 'Shops', icon: Store },
    { path: '/tenants', label: 'Tenants', icon: Users },
    { path: '/ledger', label: 'Ledgers', icon: FileText },
    { path: '/sales', label: 'Sales & Allocations', icon: Receipt },
    { path: '/payments', label: 'Payments', icon: CreditCard },
  ];

  if (currentUser?.email === 'talhanaveed89@gmail.com') {
    navItems.push({ path: '/admin', label: 'Admin Panel', icon: ShieldAlert });
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Store size={24} color="#f59e0b" />
          PlazaManager
        </div>
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
      </aside>
      <main className="main-content">
        <header className="topbar">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Plaza Management System</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}
              title="Logout"
            >
              <LogOut size={16} />
              <span style={{ fontSize: '0.875rem' }}>Logout</span>
            </button>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
