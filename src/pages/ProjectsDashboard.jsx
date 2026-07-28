import { useState, useMemo } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useSupabase } from '../hooks/useSupabase';
import { Building2, Store, Users, DollarSign, ChevronRight } from 'lucide-react';

export default function ProjectsDashboard() {
  const { projects, changeActiveProject } = useProject();
  
  // Since activeProject is null here, useSupabase fetches ALL data across all projects
  const allShops = useSupabase('shops') || [];
  const allSales = useSupabase('sales') || [];
  const allPayments = useSupabase('payments') || [];

  // Group data by project_id
  const projectSummaries = useMemo(() => {
    return projects.map(project => {
      const pId = project.id;
      
      const pShops = allShops.filter(s => s.project_id === pId);
      const pSales = allSales.filter(s => s.project_id === pId);
      const pPayments = allPayments.filter(p => p.project_id === pId);

      const totalShops = pShops.length;
      const occupiedShops = pShops.filter(s => s.status === 'Occupied').length;
      
      // Calculate total pending balance for this project
      const totalSalesValue = pSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const totalPaymentsValue = pPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPendingBalance = totalSalesValue - totalPaymentsValue;

      return {
        ...project,
        totalShops,
        occupiedShops,
        totalPendingBalance,
        totalSalesValue,
        totalPaymentsValue
      };
    });
  }, [projects, allShops, allSales, allPayments]);

  if (projects.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Building2 size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem auto' }} />
        <h2>No Projects Found</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Use the sidebar to create your first project.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>All Projects</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Select a project to view details and manage it.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {projectSummaries.map((project) => (
          <div 
            key={project.id} 
            className="card" 
            style={{ 
              cursor: 'pointer', 
              transition: 'transform 0.2s, box-shadow 0.2s',
              border: '1px solid var(--color-border)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => changeActiveProject(project.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                    <Building2 size={24} color="#f59e0b" />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{project.name}</h2>
                </div>
                <ChevronRight size={20} color="var(--color-text-muted)" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Store size={14} /> Total Shops
                  </p>
                  <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>{project.totalShops}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Users size={14} /> Occupied
                  </p>
                  <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>{project.occupiedShops}</p>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <DollarSign size={14} /> Pending Balance
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: project.totalPendingBalance > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                  Rs {project.totalPendingBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
