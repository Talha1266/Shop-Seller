import { useState, useMemo } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useSupabase } from '../hooks/useSupabase';
import { Building2, Store, Users, DollarSign, ChevronRight, Plus, X, Trash2, AlertTriangle } from 'lucide-react';

export default function ProjectsDashboard() {
  const { projects, changeActiveProject, createProject, deleteProject, forceDeleteProject } = useProject();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
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

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim());
      setIsCreatingProject(false);
      setNewProjectName('');
    } catch (err) {
      console.error(err);
      alert("Failed to create project. Error: " + err.message);
    }
  };

  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${projectName}? This action cannot be undone.`)) return;
    
    try {
      await deleteProject(projectId);
    } catch (err) {
      console.error(err);
      if (err.code === '23503') { // Foreign key constraint error
        const force = window.confirm(`WARNING: ${projectName} contains active shops, tenants, or financial records!\n\nIf you proceed, ALL data inside this project will be permanently destroyed. Are you absolutely sure you want to force delete it?`);
        if (force) {
          try {
            await forceDeleteProject(projectId);
          } catch (forceErr) {
            console.error(forceErr);
            alert("Failed to force delete project. Error: " + forceErr.message);
          }
        }
      } else {
        alert("Failed to delete project. Error: " + err.message);
      }
    }
  };

  if (projects.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Building2 size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem auto' }} />
        <h2>No Projects Found</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 1.5rem 0' }}>
          Create your first project to get started.
        </p>
        <button className="btn btn-primary" onClick={() => setIsCreatingProject(true)} style={{ margin: '0 auto' }}>
          <Plus size={20} /> Create Project
        </button>
        {isCreatingProject && (
          <div className="modal-overlay" onClick={() => setIsCreatingProject(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'left' }}>
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>All Projects</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Select a project to view details and manage it.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreatingProject(true)}>
          <Plus size={20} /> Create Project
        </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                    className="icon-btn" 
                    title="Delete Project"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={20} />
                  </button>
                  <ChevronRight size={20} color="var(--color-text-muted)" />
                </div>
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
