import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X, Paperclip, Download, Trash2, FileText } from 'lucide-react';

export default function Tenants() {
  const db = useDb();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedTenantForDocs, setSelectedTenantForDocs] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedShopId, setSelectedShopId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [cnicVal, setCnicVal] = useState('');
  const [mobileVal, setMobileVal] = useState('');

  useEffect(() => {
    if (location.state?.preSelectShopId) {
      setSelectedShopId(location.state.preSelectShopId.toString());
      setIsModalOpen(true);
      const state = { ...location.state };
      delete state.preSelectShopId;
      navigate(location.pathname, { state, replace: true });
    }
  }, [location.state, location.pathname, navigate]);
  
  const tenants = useSupabase('tenants') || [];
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const documents = useSupabase('documents') || [];
  
  const availableShops = shops.filter(s => s.status === 'Available');

  const getShopDetails = (tenantId) => {
    const tenantSales = sales.filter(s => s.tenantId === tenantId);
    if (tenantSales.length === 0) return 'None';
    
    const shopDetails = tenantSales.map(sale => {
      const shop = shops.find(s => s.id === sale.shopId);
      return shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : 'Unknown';
    });
    
    return shopDetails.join(', ');
  };

  const handleDeleteTenant = async (tenant) => {
    if (window.confirm(`Are you sure you want to delete ${tenant.name}? This will remove all their sales, installments, and payment records, and free up their shops.`)) {
      try {
        const tenantSales = sales.filter(s => s.tenantId === tenant.id);
        
        for (const sale of tenantSales) {
          // Find and delete child records
          const insts = installments.filter(i => i.saleId === sale.id);
          const pmts = payments.filter(p => p.saleId === sale.id);
          for (const i of insts) await db.installments.delete(i.id);
          for (const p of pmts) await db.payments.delete(p.id);
          
          // Delete sale and free shop
          await db.sales.delete(sale.id);
          await db.shops.update(sale.shopId, { status: 'Available' });
        }
        
        // Delete documents
        const docs = documents.filter(d => d.tenantId === tenant.id);
        for (const d of docs) await db.documents.delete(d.id);
        
        // Finally, delete the tenant
        await db.tenants.delete(tenant.id);
      } catch (err) {
        console.error("Error deleting tenant:", err);
        alert("Failed to delete tenant. Check console for details.");
      }
    }
  };

  const formatCNIC = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 13) val = val.slice(0, 13);
    let formatted = '';
    if (val.length > 0) formatted += val.substring(0, 5);
    if (val.length > 5) formatted += '-' + val.substring(5, 12);
    if (val.length > 12) formatted += '-' + val.substring(12, 13);
    e.target.value = formatted;
  };

  const formatMobile = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    let formatted = '';
    if (val.length > 0) formatted += val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 11);
    e.target.value = formatted;
  };

  const handleAddTenant = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    if (!selectedShopId) {
      alert('Please select a shop.');
      return;
    }

    const cnic = formData.get('cnic');
    const mobile = formData.get('mobile');

    // Validate CNIC: must be exactly XXXXX-XXXXXXX-X
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic)) {
      alert('❌ Invalid CNIC format.\n\nRequired format: XXXXX-XXXXXXX-X\nExample: 35201-1234567-8\n\nPlease enter all 13 digits in the correct format.');
      return;
    }

    // Validate Mobile: must be exactly XXXX-XXXXXXX
    const mobileRegex = /^\d{4}-\d{7}$/;
    if (!mobileRegex.test(mobile)) {
      alert('❌ Invalid mobile number format.\n\nRequired format: XXXX-XXXXXXX\nExample: 0300-1234567\n\nPlease enter all 11 digits in the correct format.');
      return;
    }

    const newTenant = {
      name: formData.get('name'),
      cnic,
      mobile
    };

    try {
      const tenantId = await db.tenants.add(newTenant);

      const newSale = {
        shopId: selectedShopId,
        tenantId: tenantId,
        date: formData.get('date'),
        totalAmount: parseFloat(formData.get('totalAmount')),
        advancePayment: parseFloat(formData.get('advancePayment') || 0),
        isCompleted: false
      };

      await db.sales.add(newSale);
      // Update shop status AND sync its price to the actual sale amount
      await db.shops.update(selectedShopId, { status: 'Occupied', price: newSale.totalAmount });

      setSelectedShopId('');
      setTotalAmount('');
      setCnicVal('');
      setMobileVal('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error registering tenant:', err);
      alert('Failed to register tenant. Error: ' + err.message);
    }
  };

  // --- Documents Logic ---
  const handleOpenDocs = (tenant) => {
    setSelectedTenantForDocs(tenant);
    setIsDocModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTenantForDocs) return;

    try {
      // Upload to Supabase Storage bucket "tenant-documents"
      const filePath = `${selectedTenantForDocs.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('tenant-documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Save metadata to documents table
      await db.documents.add({
        tenantId: selectedTenantForDocs.id,
        name: file.name,
        type: file.type,
        date: new Date().toISOString(),
        storagePath: filePath
      });

      e.target.value = null;
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload document. Error: ' + err.message);
    }
  };

  const handleDownloadDoc = async (doc) => {
    try {
      const { data, error } = await supabase.storage
        .from('tenant-documents')
        .createSignedUrl(doc.storagePath, 60);

      if (error) throw error;

      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = doc.name;
      a.target = '_blank';
      a.click();
    } catch (err) {
      alert('Failed to download document. Error: ' + err.message);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      // Remove from storage
      if (doc.storagePath) {
        await supabase.storage.from('tenant-documents').remove([doc.storagePath]);
      }
      // Remove record
      await db.documents.delete(doc.id);
    } catch (err) {
      alert('Failed to delete document. Error: ' + err.message);
    }
  };


  const currentTenantDocs = selectedTenantForDocs 
    ? documents.filter(d => d.tenantId === selectedTenantForDocs.id)
    : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tenants Directory</h1>
        <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); }}>
          <Plus size={18} /> Register Tenant & Allocate Shop
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>CNIC No.</th>
                <th>Mobile Number</th>
                <th>Allocated Shop</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No tenants found. Add one to get started.</td></tr>
              ) : (() => {
                // Floor ordering: Ground first, then First, Second, Third, etc.
                const floorOrder = (name = '') => {
                  const n = name.toLowerCase().trim();
                  if (n.includes('ground')) return 0;
                  if (n.includes('first')  || n === '1st') return 1;
                  if (n.includes('second') || n === '2nd') return 2;
                  if (n.includes('third')  || n === '3rd') return 3;
                  if (n.includes('fourth') || n === '4th') return 4;
                  const num = parseInt(n);
                  return isNaN(num) ? 99 : num + 10;
                };

                const sortedTenants = [...tenants].sort((a, b) => {
                  const saleA = sales.find(s => s.tenantId === a.id);
                  const saleB = sales.find(s => s.tenantId === b.id);
                  const shopA = saleA ? shops.find(s => s.id === saleA.shopId) : null;
                  const shopB = saleB ? shops.find(s => s.id === saleB.shopId) : null;

                  // Block: alphabetical (A, B, C...)
                  const blockCmp = (shopA?.block || '').localeCompare(shopB?.block || '');
                  if (blockCmp !== 0) return blockCmp;

                  // Floor: Ground → First → Second...
                  const floorCmp = floorOrder(shopA?.floor) - floorOrder(shopB?.floor);
                  if (floorCmp !== 0) return floorCmp;

                  // Shop Number: numeric ascending
                  return parseInt(shopA?.shopNumber || 0) - parseInt(shopB?.shopNumber || 0);
                });

                return sortedTenants.map(tenant => (
                  <tr key={tenant.id}>
                    <td style={{ fontWeight: 500 }}>{tenant.name}</td>
                    <td>{tenant.cnic}</td>
                    <td>{tenant.mobile}</td>
                    <td>{getShopDetails(tenant.id)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenDocs(tenant)}
                        title="Manage Documents"
                      >
                        <Paperclip size={14} /> Docs
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#f87171', marginLeft: '0.5rem' }}
                        onClick={() => handleDeleteTenant(tenant)}
                        title="Delete Tenant"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Register Tenant & Allocate Shop</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTenant}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Tenant Details</h3>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" name="name" className="form-control" required />
              </div>
              <div className="form-group">
                <label className="form-label">CNIC No.</label>
                <input
                  type="text"
                  name="cnic"
                  className="form-control"
                  required
                  placeholder="XXXXX-XXXXXXX-X"
                  maxLength="15"
                  value={cnicVal}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                    let fmt = '';
                    if (val.length > 0) fmt += val.substring(0, 5);
                    if (val.length > 5) fmt += '-' + val.substring(5, 12);
                    if (val.length > 12) fmt += '-' + val.substring(12, 13);
                    setCnicVal(fmt);
                  }}
                  style={{
                    borderColor: cnicVal.length === 0 ? undefined
                      : /^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '#16a34a' : '#ef4444'
                  }}
                />
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0,
                  color: cnicVal.length === 0 ? 'var(--color-text-muted)'
                    : /^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '#16a34a' : '#ef4444' }}>
                  {/^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '✓ Valid CNIC' : 'Format: XXXXX-XXXXXXX-X (13 digits)'}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  name="mobile"
                  className="form-control"
                  required
                  placeholder="XXXX-XXXXXXX"
                  maxLength="12"
                  value={mobileVal}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let fmt = '';
                    if (val.length > 0) fmt += val.substring(0, 4);
                    if (val.length > 4) fmt += '-' + val.substring(4, 11);
                    setMobileVal(fmt);
                  }}
                  style={{
                    borderColor: mobileVal.length === 0 ? undefined
                      : /^\d{4}-\d{7}$/.test(mobileVal) ? '#16a34a' : '#ef4444'
                  }}
                />
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0,
                  color: mobileVal.length === 0 ? 'var(--color-text-muted)'
                    : /^\d{4}-\d{7}$/.test(mobileVal) ? '#16a34a' : '#ef4444' }}>
                  {/^\d{4}-\d{7}$/.test(mobileVal) ? '✓ Valid mobile number' : 'Format: XXXX-XXXXXXX (11 digits)'}
                </p>
              </div>

              <h3 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Shop Allocation Details</h3>

              <div className="form-group">
                <label className="form-label">Date of Allocation</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="form-group">
                <label className="form-label">Select Available Shop</label>
                <select
                  className="form-control"
                  required
                  value={selectedShopId}
                  onChange={e => setSelectedShopId(e.target.value)}
                >
                  <option value="">-- Select Available Shop --</option>
                  {availableShops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      Shop {shop.shopNumber} — Block {shop.block}, {shop.floor}{shop.side ? ` (${shop.side} Side)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Total Sale Amount (Rs.)</label>
                <input
                  type="number"
                  name="totalAmount"
                  className="form-control"
                  required min="0" step="0.01"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="e.g. 500000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Advance Payment (Rs.)</label>
                <input
                  type="number"
                  name="advancePayment"
                  className="form-control"
                  min="0" step="0.01"
                  defaultValue="0"
                />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={availableShops.length === 0}>Complete Registration</button>
              </div>
              {availableShops.length === 0 && (
                <p style={{ color: 'var(--color-warning-text)', fontSize: '0.875rem', marginTop: '1rem', textAlign: 'center' }}>
                  No available shops to allocate. Please add shops first.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {isDocModalOpen && selectedTenantForDocs && (
        <div className="modal-overlay" onClick={() => setIsDocModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Documents: {selectedTenantForDocs.name}</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {getShopDetails(selectedTenantForDocs.id)}
              </p>
              <button className="modal-close" onClick={() => setIsDocModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', textAlign: 'center', marginBottom: '1.5rem' }}>
              <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Paperclip size={24} color="#64748b" />
                <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Click to Upload Document</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Max recommended size: 5MB per file)</span>
                <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Attached Documents</h3>
            {currentTenantDocs.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentTenantDocs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <FileText size={18} color="#64748b" />
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(doc.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDownloadDoc(doc)} title="Download">
                        <Download size={14} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={() => handleDeleteDoc(doc)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDocModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
