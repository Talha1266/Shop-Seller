import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { supabase } from '../supabaseClient';
import { Trash2, User, Check, X } from 'lucide-react';

export default function AdminPanel() {
  const dbUsers = useSupabase('users') || [];
  const [optimisticUsers, setOptimisticUsers] = useState({});

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
    </div>
  );
}
