import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X } from 'lucide-react';

export default function Sales() {
  const db = useDb();
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      isCompleted: false
    };
    
    await db.sales.add(newSale);
    await db.shops.update(shopId, { status: 'Occupied' });
    
    setIsModalOpen(false);
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
    </div>
  );
}
