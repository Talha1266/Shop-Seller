import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X, Edit, Trash2 } from 'lucide-react';

export default function Sales() {
  const db = useDb();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const sales = useSupabase('sales') || [];
  const shops = useSupabase('shops') || [];
  const tenants = useSupabase('tenants') || [];

  const handleAddSale = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const shopId = formData.get('shopId');
    const totalAmount = parseFloat(formData.get('totalAmount'));
    const advancePayment = parseFloat(formData.get('advancePayment'));
    const tenantId = formData.get('tenantId');
    
    const newSale = {
      shopId: shopId,
      tenantId: tenantId,
      date: formData.get('date'),
      totalAmount: totalAmount,
      advancePayment: advancePayment,
      monthly_rent: parseFloat(formData.get('monthly_rent') || 0),
      isCompleted: false
    };
    
    await db.sales.add(newSale);
    await db.shops.update(shopId, { status: 'Occupied' });
    
    setIsModalOpen(false);
  };

  const handleEditSale = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;
    
    const formData = new FormData(e.target);
    const updates = {
      totalAmount: parseFloat(formData.get('totalAmount')),
      advancePayment: parseFloat(formData.get('advancePayment')),
      monthly_rent: parseFloat(formData.get('monthly_rent') || 0),
      date: formData.get('date')
    };

    try {
      await db.sales.update(selectedSale.id, updates);
      setIsEditModalOpen(false);
      setSelectedSale(null);
    } catch (err) {
      alert('Failed to update sale: ' + err.message);
    }
  };

  const handleDeleteSale = async (sale) => {
    const code = window.prompt("SAFETY LOCK ACTIVE\n\nTo delete this allocation, type 'CONFIRM':");
    if (code !== 'CONFIRM') {
      if (code !== null) alert("Incorrect code. Deletion cancelled.");
      return;
    }
    
    try {
      // Find related payments and installments
      const { data: payments } = await supabase.from('payments').select('id').eq('saleId', sale.id);
      if (payments?.length > 0) {
        await supabase.from('payments').delete().eq('saleId', sale.id);
      }
      
      const { data: installments } = await supabase.from('installments').select('id').eq('sale_id', sale.id);
      if (installments?.length > 0) {
        await supabase.from('installments').delete().eq('sale_id', sale.id);
      }
      
      // Update shop status
      await db.shops.update(sale.shopId, { status: 'Available' });
      
      // Delete sale
      await db.sales.delete(sale.id);
    } catch (err) {
      alert("Error deleting sale: " + err.message);
    }
  };

  const getShopName = (id) => {
    const shop = shops.find(s => s.id === id);
    return shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : 'Unknown';
  };
  const getTenantName = (id) => tenants.find(t => t.id === id)?.name || 'Unknown';

  const availableShops = shops.filter(s => s.status === 'Available');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sales & Allocations</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Allocation
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shop</th>
                <th>Tenant</th>
                <th>Total Amount</th>
                <th>Advance Payment</th>
                <th>Balance</th>
                <th>Monthly Rent</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No sales allocations found.</td></tr>
              ) : (() => {
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

                const sortedSales = [...sales].sort((a, b) => {
                  const shopA = shops.find(s => s.id === a.shopId);
                  const shopB = shops.find(s => s.id === b.shopId);

                  const blockCmp = (shopA?.block || '').localeCompare(shopB?.block || '');
                  if (blockCmp !== 0) return blockCmp;

                  const floorCmp = floorOrder(shopA?.floor) - floorOrder(shopB?.floor);
                  if (floorCmp !== 0) return floorCmp;

                  return parseInt(shopA?.shopNumber || 0) - parseInt(shopB?.shopNumber || 0);
                });

                return sortedSales.map(sale => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 500 }}>{getShopName(sale.shopId)}</td>
                    <td>{getTenantName(sale.tenantId)}</td>
                    <td>Rs. {sale.totalAmount.toLocaleString()}</td>
                    <td>Rs. {sale.advancePayment.toLocaleString()}</td>
                    <td>Rs. {(sale.totalAmount - sale.advancePayment).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      Rs. {(sale.monthly_rent || 0).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => { setSelectedSale(sale); setIsEditModalOpen(true); }}
                        title="Edit Allocation & Rent"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2', marginLeft: '0.5rem' }}
                        onClick={() => handleDeleteSale(sale)}
                        title="Delete Allocation"
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
              <h2 className="modal-title">New Shop Allocation</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddSale}>
              <div className="form-group">
                <label className="form-label">Select Shop</label>
                <select name="shopId" className="form-control" required>
                  <option value="">-- Select Available Shop --</option>
                  {availableShops.map(shop => (
                    <option key={shop.id} value={shop.id}>Shop {shop.shopNumber} (Block {shop.block} - {shop.floor})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Tenant</label>
                <select name="tenantId" className="form-control" required>
                  <option value="">-- Select Tenant --</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.mobile})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Sale</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Amount</label>
                <input type="number" name="totalAmount" className="form-control" required min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Advance Payment</label>
                <input type="number" name="advancePayment" className="form-control" required min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Rent (Optional)</label>
                <input type="number" name="monthly_rent" className="form-control" min="0" step="0.01" defaultValue="0" />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>If the tenant must pay a monthly rent after buying, enter it here.</span>
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={availableShops.length === 0 || tenants.length === 0}>
                  Allocate Shop
                </button>
              </div>
              {(availableShops.length === 0 || tenants.length === 0) && (
                <p style={{ color: 'var(--color-warning-text)', fontSize: '0.875rem', marginTop: '1rem', textAlign: 'center' }}>
                  Please ensure you have added at least one available shop and one tenant first.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedSale && (
        <div className="modal-overlay" onClick={() => { setIsEditModalOpen(false); setSelectedSale(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Allocation Details</h2>
              <button className="modal-close" onClick={() => { setIsEditModalOpen(false); setSelectedSale(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleEditSale}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Shop:</strong> {getShopName(selectedSale.shopId)}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}><strong>Tenant:</strong> {getTenantName(selectedSale.tenantId)}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Date of Sale</label>
                <input type="date" name="date" className="form-control" required defaultValue={selectedSale.date ? new Date(selectedSale.date).toISOString().split('T')[0] : ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Amount</label>
                <input type="number" name="totalAmount" className="form-control" required min="0" step="0.01" defaultValue={selectedSale.totalAmount} />
              </div>
              <div className="form-group">
                <label className="form-label">Advance Payment</label>
                <input type="number" name="advancePayment" className="form-control" required min="0" step="0.01" defaultValue={selectedSale.advancePayment} />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Rent (Optional)</label>
                <input type="number" name="monthly_rent" className="form-control" min="0" step="0.01" defaultValue={selectedSale.monthly_rent || 0} />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>If the tenant must pay a monthly rent after buying, enter it here.</span>
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsEditModalOpen(false); setSelectedSale(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
