import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../supabaseClient';
import { Trash2, User, Check, X, AlertTriangle } from 'lucide-react';
import { useDb } from '../hooks/useDb';

export default function AdminPanel() {
  const dbUsers = useSupabase('users') || [];
  const [optimisticUsers, setOptimisticUsers] = useState({});
  const [purging, setPurging] = useState(false);
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];
  const tenants = useSupabase('tenants') || [];
  const db = useDb();

  // Count orphaned records (for display)
  const shopIds = new Set(shops.map(s => s.id));
  const orphanedSales = sales.filter(s => !shopIds.has(s.shopId));
  const orphanedSaleIds = new Set(orphanedSales.map(s => s.id));
  const orphanedTenantIds = new Set(orphanedSales.map(s => s.tenantId).filter(Boolean));
  const orphanedPayments = payments.filter(p => {
    const byTenant = p.tenantId && orphanedTenantIds.has(p.tenantId);
    const bySale = p.saleId && orphanedSaleIds.has(p.saleId);
    return byTenant || bySale;
  });
  const orphanedTenants = tenants.filter(t => orphanedTenantIds.has(t.id));

  const handlePurgeOrphanedData = async () => {
    const total = orphanedPayments.length + orphanedSales.length + orphanedTenants.length;
    if (total === 0) {
      alert('No orphaned data found. Everything looks clean!');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete:\n` +
      `  • ${orphanedPayments.length} orphaned payment(s)\n` +
      `  • ${orphanedSales.length} orphaned sale(s)\n` +
      `  • ${orphanedTenants.length} orphaned tenant(s)\n\n` +
      `These records have no associated shop.\nThis cannot be undone. Proceed?`
    );
    if (!confirmed) return;

    setPurging(true);
    try {
      // Delete orphaned payments
      if (orphanedSaleIds.size > 0) {
        await supabase.from('payments').delete().in('saleId', [...orphanedSaleIds]);
        await supabase.from('installments').delete().in('sale_id', [...orphanedSaleIds]);
      }
      if (orphanedTenantIds.size > 0) {
        await supabase.from('payments').delete().in('tenantId', [...orphanedTenantIds]);
        await supabase.from('documents').delete().in('tenantId', [...orphanedTenantIds]);
      }
      // Delete orphaned sales
      for (const sale of orphanedSales) {
        await db.sales.delete(sale.id);
      }
      // Delete orphaned tenants
      if (orphanedTenantIds.size > 0) {
        await supabase.from('tenants').delete().in('id', [...orphanedTenantIds]);
      }
      alert(`✅ Purge complete! Removed ${total} orphaned record(s).`);
    } catch (err) {
      console.error(err);
      alert('Failed to purge orphaned data: ' + err.message);
    } finally {
      setPurging(false);
    }
  };

  const users = dbUsers.map(u => {
    if (optimisticUsers[u.id] !== undefined) {
      return { ...u, is_approved: optimisticUsers[u.id] };
    }
    return u;
  });

  const handleToggleApproval = async (user) => {
    if (user.username === 'talhanaveed89@gmail.com') {
      alert("Cannot revoke access from the root administrator.");
      return;
    }
    
    const targetState = !user.is_approved;
    setOptimisticUsers(prev => ({ ...prev, [user.id]: targetState }));
    
    try {
      const { error } = await supabase.from('users').update({ is_approved: targetState }).eq('id', user.id);
      if (error) {
        console.error("Update error:", error);
        alert("Failed to update user approval: " + error.message);
        // Revert on error
        setOptimisticUsers(prev => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
      }
    } catch (err) {
      alert("Error: " + err.message);
      setOptimisticUsers(prev => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (username === 'talhanaveed89@gmail.com') {
      alert("Cannot delete the root administrator.");
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this user profile? Note: This only deletes their application profile, not their Supabase Auth identity.')) {
      await supabase.from('users').delete().eq('id', id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Email / Username</th>
                <th>Status</th>
                <th>Role</th>
                <th>System ID</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} color="var(--color-text-muted)" />
                    </div>
                    {user.username}
                  </td>
                  <td>
                    {user.is_approved ? (
                      <span className="badge badge-success">Approved</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>Locked</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-secondary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>#{user.id}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className={`btn ${user.is_approved ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                      onClick={() => handleToggleApproval(user)}
                      disabled={user.username === 'talhanaveed89@gmail.com'}
                    >
                      {user.is_approved ? (
                        <><X size={14} style={{ marginRight: '4px' }} /> Revoke</>
                      ) : (
                        <><Check size={14} style={{ marginRight: '4px' }} /> Approve</>
                      )}
                    </button>
                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', color: 'var(--color-danger)', borderColor: 'transparent', backgroundColor: 'transparent' }}
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      disabled={user.username === 'talhanaveed89@gmail.com'}
                      title="Delete User Profile"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orphaned Data Purge */}
      <div className="card" style={{ marginTop: '2rem', border: '1px solid #fca5a5', backgroundColor: '#fff5f5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <AlertTriangle size={28} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>Purge Orphaned Data</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.9rem' }}>
              Remove payments, sales, and tenants that are no longer linked to any shop.
              This is useful after shops have been deleted without cascade.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <span style={{ color: orphanedPayments.length > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                💳 {orphanedPayments.length} orphaned payment(s)
              </span>
              <span style={{ color: orphanedSales.length > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                📄 {orphanedSales.length} orphaned sale(s)
              </span>
              <span style={{ color: orphanedTenants.length > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                👤 {orphanedTenants.length} orphaned tenant(s)
              </span>
            </div>
            <button
              className="btn"
              style={{ backgroundColor: '#dc2626', color: 'white', opacity: purging ? 0.6 : 1 }}
              onClick={handlePurgeOrphanedData}
              disabled={purging}
            >
              <Trash2 size={16} />
              {purging ? 'Purging...' : 'Purge Orphaned Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
