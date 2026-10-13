import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { 
  Building2, Fuel, Store, Users, DollarSign, ChevronRight, 
  Plus, X, Trash2, MapPin, Maximize, Calendar, Clock, TrendingUp 
} from 'lucide-react';
import { getPumpIntervalYears, getPumpFixedRentYears, cleanGracePeriod } from './PetrolPumpDetail';

export default function ProjectsDashboard() {
  const navigate = useNavigate();
  const db = useDb();
  const { projects, changeActiveProject, createProject, deleteProject, forceDeleteProject } = useProject();

  // Tab state: 'plazas' or 'petrol_pumps'
  const [activePropertyTab, setActivePropertyTab] = useState('plazas');

  // Plaza Creation state
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Petrol Pump Creation state
  const [isCreatingPump, setIsCreatingPump] = useState(false);
  const [pumpForm, setPumpForm] = useState({
    name: '',
    location: '',
    total_area: '',
    lease_deed_reg_date: '',
    total_lease_period: '',
    lease_start_date: '',
    lease_end_date: '',
    grace_period: '',
    monthly_rent: '',
    fixed_rent_years: '3',
    annual_increase_pct: '',
    increase_interval_years: '3'
  });

  // Since activeProject is null here, useSupabase fetches ALL data across all projects
  const allShops = useSupabase('shops') || [];
  const allSales = useSupabase('sales') || [];
  const allPayments = useSupabase('payments') || [];
  const allPetrolPumps = useSupabase('petrol_pumps') || [];

  // Group data by project_id for plazas
  const projectSummaries = useMemo(() => {
    return projects.map(project => {
      const pId = project.id;
      
      const pShops = allShops.filter(s => s.project_id === pId);
      const pSales = allSales.filter(s => s.project_id === pId);
      const pPayments = allPayments.filter(p => p.project_id === pId);

      const totalShops = pShops.length;
      const occupiedShops = pShops.filter(s => s.status === 'Occupied').length;
      
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

  // Handle Create Plaza Project
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

  // Handle Delete Plaza Project
  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    const code = window.prompt(`SAFETY LOCK ACTIVE\n\nTo delete project "${projectName}", type 'CONFIRM':`);
    if (code !== 'CONFIRM') {
      if (code !== null) alert("Invalid confirmation code.");
      return;
    }
    
    try {
      await deleteProject(projectId);
    } catch (err) {
      console.error(err);
      if (err.code === '23503') { // Foreign key constraint error
        const forceCode = window.prompt(`CRITICAL WARNING: ${projectName} contains active shops, tenants, or financial records!\n\nIf you proceed, ALL data inside this project will be permanently destroyed.\n\nType '${projectName}' exactly to force delete:`);
        if (forceCode === projectName) {
          try {
            await forceDeleteProject(projectId);
          } catch (forceErr) {
            console.error(forceErr);
            alert("Failed to force delete project. Error: " + forceErr.message);
          }
        } else if (forceCode !== null) {
           alert("Project name did not match. Deletion cancelled.");
        }
      } else {
        alert("Failed to delete project. Error: " + err.message);
      }
    }
  };

  // Handle Create Petrol Pump
  const handleCreatePump = async (e) => {
    e.preventDefault();
    if (!pumpForm.name.trim() || !pumpForm.location.trim()) {
      alert("Please enter the Petrol Pump Name and Location.");
      return;
    }

    try {
      const rawGrace = cleanGracePeriod(pumpForm.grace_period);
      const intervalVal = Number(pumpForm.increase_interval_years) || 1;
      const fixedVal = Number(pumpForm.fixed_rent_years) || 1;

      const newPump = {
        name: pumpForm.name.trim(),
        location: pumpForm.location.trim(),
        total_area: pumpForm.total_area.trim(),
        lease_deed_reg_date: pumpForm.lease_deed_reg_date || null,
        total_lease_period: pumpForm.total_lease_period.trim(),
        lease_start_date: pumpForm.lease_start_date || null,
        lease_end_date: pumpForm.lease_end_date || null,
        grace_period: rawGrace || '',
        monthly_rent: Number(pumpForm.monthly_rent) || 0,
        fixed_rent_years: fixedVal,
        annual_increase_pct: Number(pumpForm.annual_increase_pct) || 0,
        increase_interval_years: intervalVal
      };

      let pumpId;
      try {
        pumpId = await db.petrol_pumps.add(newPump);
      } catch (addErr) {
        if (addErr.message && (addErr.message.includes('fixed_rent_years') || addErr.message.includes('increase_interval_years') || addErr.code === '42703')) {
          const metaString = `[FixedYears: ${fixedVal}] [Interval: ${intervalVal}]`;
          const fallbackPump = { 
            ...newPump,
            grace_period: rawGrace ? `${rawGrace} ${metaString}` : metaString
          };
          delete fallbackPump.fixed_rent_years;
          delete fallbackPump.increase_interval_years;
          pumpId = await db.petrol_pumps.add(fallbackPump);
        } else {
          throw addErr;
        }
      }

      setIsCreatingPump(false);
      setPumpForm({
        name: '',
        location: '',
        total_area: '',
        lease_deed_reg_date: '',
        total_lease_period: '',
        lease_start_date: '',
        lease_end_date: '',
        grace_period: '',
        monthly_rent: '',
        fixed_rent_years: '3',
        annual_increase_pct: '',
        increase_interval_years: '3'
      });

      if (pumpId) {
        navigate(`/petrol-pump/${pumpId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add Petrol Pump. If you haven't run the SQL migration yet, please run it in your Supabase SQL editor.\n\nError: " + err.message);
    }
  };

  // Handle Delete Petrol Pump
  const handleDeletePump = async (e, pumpId, pumpName) => {
    e.stopPropagation();
    const code = window.prompt(`SAFETY LOCK ACTIVE\n\nTo delete petrol pump "${pumpName}", type 'CONFIRM':`);
    if (code !== 'CONFIRM') {
      if (code !== null) alert("Invalid confirmation code.");
      return;
    }

    try {
      await db.petrol_pumps.delete(pumpId);
    } catch (err) {
      console.error(err);
      alert("Failed to delete petrol pump: " + err.message);
    }
  };

  return (
    <div>
      {/* Property Category Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--color-border)', marginBottom: '2rem' }}>
        <button
          onClick={() => setActivePropertyTab('plazas')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 1.25rem',
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: activePropertyTab === 'plazas' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activePropertyTab === 'plazas' ? '3px solid var(--color-primary)' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          <Building2 size={20} /> Plazas & Complexes ({projects.length})
        </button>

        <button
          onClick={() => setActivePropertyTab('petrol_pumps')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 1.25rem',
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: activePropertyTab === 'petrol_pumps' ? '#ef4444' : 'var(--color-text-muted)',
            borderBottom: activePropertyTab === 'petrol_pumps' ? '3px solid #ef4444' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          <Fuel size={20} /> Petrol Pumps ({allPetrolPumps.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PLAZAS & SHOPPING COMPLEXES                        */}
      {/* ========================================================= */}
      {activePropertyTab === 'plazas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Commercial Plazas</h1>
              <p style={{ color: 'var(--color-text-muted)' }}>Select a plaza project to manage shops, tenants, and collections.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsCreatingProject(true)}>
              <Plus size={20} /> Create Plaza Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Building2 size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem auto' }} />
              <h2>No Plaza Projects Found</h2>
              <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 1.5rem 0' }}>
                Create your first plaza project to get started.
              </p>
              <button className="btn btn-primary" onClick={() => setIsCreatingProject(true)} style={{ margin: '0 auto' }}>
                <Plus size={20} /> Create Plaza Project
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
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
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PETROL PUMPS                                       */}
      {/* ========================================================= */}
      {activePropertyTab === 'petrol_pumps' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Petrol Pumps</h1>
              <p style={{ color: 'var(--color-text-muted)' }}>Manage leased petrol pump properties, lease agreements, escalation schedules, and rentals.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsCreatingPump(true)} style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
              <Plus size={20} /> Add Petrol Pump
            </button>
          </div>

          {allPetrolPumps.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Fuel size={52} color="#ef4444" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
              <h2>No Petrol Pumps Added Yet</h2>
              <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 1.5rem 0', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Add your leased petrol pump stations to manage lease periods, annual rent escalation schedules, and printable monthly receipts.
              </p>
              <button className="btn btn-primary" onClick={() => setIsCreatingPump(true)} style={{ margin: '0 auto', backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
                <Plus size={20} /> Add Petrol Pump
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {allPetrolPumps.map((pump) => (
                <div 
                  key={pump.id} 
                  className="card" 
                  style={{ 
                    cursor: 'pointer', 
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    border: '1px solid var(--color-border)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => navigate(`/petrol-pump/${pump.id}`)}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <Fuel size={26} color="#ef4444" />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>{pump.name}</h2>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            Leased Petrol Pump
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button 
                          onClick={(e) => handleDeletePump(e, pump.id, pump.name)}
                          className="icon-btn" 
                          title="Delete Petrol Pump"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Trash2 size={20} />
                        </button>
                        <ChevronRight size={20} color="var(--color-text-muted)" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                      {pump.location && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={14} /> {pump.location}
                        </p>
                      )}
                      {pump.total_area && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Maximize size={14} /> Area: {pump.total_area}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.25rem 0' }}>
                          Monthly Rent
                        </p>
                        <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>
                          Rs. {Number(pump.monthly_rent || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 0.25rem 0' }}>
                          Rent Escalation
                        </p>
                        <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                          +{pump.annual_increase_pct || 0}% / {getPumpIntervalYears(pump) > 1 ? `${getPumpIntervalYears(pump)} yrs` : 'yr'}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0 0' }}>
                          Fixed 1st {getPumpFixedRentYears(pump)} yr{getPumpFixedRentYears(pump) > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      <span>Lease: {pump.total_lease_period || 'N/A'}</span>
                      {pump.lease_start_date && (
                        <span>Period: {pump.lease_start_date} ~ {pump.lease_end_date || 'Ongoing'}</span>
                      )}
                      <span className="badge" style={{ backgroundColor: '#10b981', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.7rem' }}>
                        Active Lease
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE PLAZA PROJECT                               */}
      {/* ========================================================= */}
      {isCreatingProject && (
        <div className="modal-overlay" onClick={() => setIsCreatingProject(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Plaza Project</h2>
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
                  placeholder="e.g. Imran Shaheed Complex" 
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

      {/* ========================================================= */}
      {/* MODAL: ADD PETROL PUMP                                    */}
      {/* ========================================================= */}
      {isCreatingPump && (
        <div className="modal-overlay" onClick={() => setIsCreatingPump(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Fuel size={22} color="#ef4444" />
                <h2 className="modal-title">Add New Petrol Pump</h2>
              </div>
              <button className="icon-btn" onClick={() => setIsCreatingPump(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreatePump}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Site Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={pumpForm.name}
                  onChange={e => setPumpForm({ ...pumpForm, name: e.target.value })}
                  placeholder="e.g. M/S Gas and Oil Pakistan Limited" 
                  required 
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Location *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={pumpForm.location}
                  onChange={e => setPumpForm({ ...pumpForm, location: e.target.value })}
                  placeholder="e.g. Chak 46/NB" 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total Area</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={pumpForm.total_area}
                    onChange={e => setPumpForm({ ...pumpForm, total_area: e.target.value })}
                    placeholder="e.g. 4 Kanals or 20,000 sq ft" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Registration of Lease Deed</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={pumpForm.lease_deed_reg_date}
                    onChange={e => setPumpForm({ ...pumpForm, lease_deed_reg_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total Lease Period</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={pumpForm.total_lease_period}
                    onChange={e => setPumpForm({ ...pumpForm, total_lease_period: e.target.value })}
                    placeholder="e.g. 30 Years" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Grace Period</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={pumpForm.grace_period}
                    onChange={e => setPumpForm({ ...pumpForm, grace_period: e.target.value })}
                    placeholder="e.g. 6 Months" 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Lease Start Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={pumpForm.lease_start_date}
                    onChange={e => setPumpForm({ ...pumpForm, lease_start_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lease End Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={pumpForm.lease_end_date}
                    onChange={e => setPumpForm({ ...pumpForm, lease_end_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Starting Monthly Rent (Rs.) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={pumpForm.monthly_rent}
                    onChange={e => setPumpForm({ ...pumpForm, monthly_rent: e.target.value })}
                    placeholder="e.g. 250000" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rent Fixed For (Years) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    min="1"
                    step="1"
                    value={pumpForm.fixed_rent_years}
                    onChange={e => setPumpForm({ ...pumpForm, fixed_rent_years: e.target.value })}
                    placeholder="e.g. 3" 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Increase Rate (%) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={pumpForm.annual_increase_pct}
                    onChange={e => setPumpForm({ ...pumpForm, annual_increase_pct: e.target.value })}
                    placeholder="e.g. 10" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subsequent Increase Every (Years) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    min="1"
                    step="1"
                    value={pumpForm.increase_interval_years}
                    onChange={e => setPumpForm({ ...pumpForm, increase_interval_years: e.target.value })}
                    placeholder="e.g. 3" 
                    required 
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 1.5rem 0' }}>
                Rent will remain fixed for the first {pumpForm.fixed_rent_years || 1} year{Number(pumpForm.fixed_rent_years || 1) > 1 ? 's' : ''}, and then increment by {pumpForm.annual_increase_pct || 0}% every {pumpForm.increase_interval_years || 1} year{Number(pumpForm.increase_interval_years || 1) > 1 ? 's' : ''}.
              </p>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreatingPump(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
                  Save & Open Petrol Pump
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
