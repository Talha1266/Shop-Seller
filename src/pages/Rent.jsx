import { useState, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { Plus, X, Search, DollarSign } from 'lucide-react';

export default function Rent({ currentUser }) {
  const db = useDb();
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // Data
  const sales = useSupabase('sales') || [];
  const shops = useSupabase('shops') || [];
  const tenants = useSupabase('tenants') || [];
  const rentCollections = useSupabase('rent_collections') || [];

  // Helper to format YYYY-MM
  const getMonthString = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const selectedMonthString = getMonthString(currentDate);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getShopDetails = (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    return shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : 'Unknown Shop';
  };

  const getTenantDetails = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : 'Unknown Tenant';
  };

  // Only consider active sales with a monthly rent > 0
  const activeRentSales = useMemo(() => {
    let filtered = sales.filter(s => {
      const shop = shops.find(sh => sh.id === s.shopId);
      const rentDue = parseFloat(s.monthly_rent || shop?.monthly_rent || 0);
      return rentDue > 0;
    });
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const shop = getShopDetails(s.shopId).toLowerCase();
        const tenant = getTenantDetails(s.tenantId).toLowerCase();
        return shop.includes(q) || tenant.includes(q);
      });
    }

    return filtered.map(sale => {
      const shop = shops.find(sh => sh.id === sale.shopId);
      const rentDue = parseFloat(sale.monthly_rent || shop?.monthly_rent || 0);
      
      // Calculate amount paid for this specific month
      const monthPayments = rentCollections.filter(rc => rc.sale_id === sale.id && rc.month === selectedMonthString);
      const amountPaid = monthPayments.reduce((sum, rc) => sum + parseFloat(rc.amount_paid || 0), 0);
      
      const balance = rentDue - amountPaid;
      
      let status = 'Pending';
      if (balance <= 0) status = 'Paid';
      else if (amountPaid > 0) status = 'Partial';

      return {
        ...sale,
        rentDue,
        amountPaid,
        balance,
        status
      };
    });
  }, [sales, shops, tenants, rentCollections, selectedMonthString, searchQuery]);

  const handleReceiveRent = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;

    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount_paid'));
    
    if (amount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    const newPayment = {
      sale_id: selectedSale.id,
      month: selectedMonthString,
      amount_paid: amount,
      date: formData.get('date'),
      receipt_no: formData.get('receipt_no') || '',
      notes: formData.get('notes') || ''
    };

    try {
      await db.rent_collections.add(newPayment);
      setIsModalOpen(false);
      setSelectedSale(null);
    } catch (err) {
      alert("Error saving rent payment: " + err.message);
    }
  };

  const generateReceiptNo = () => {
    const count = rentCollections.length + 1;
    return `R-${String(count).padStart(4, '0')}`;
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="page-title">Rent & Maintenance</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--color-bg-app)', padding: '0.5rem', borderRadius: '12px' }}>
          <button className="btn btn-secondary" onClick={handlePrevMonth}>&laquo; Prev</button>
          <span style={{ fontWeight: 600, minWidth: '150px', textAlign: 'center' }}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button className="btn btn-secondary" onClick={handleNextMonth}>Next &raquo;</button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search by shop or tenant name..." 
          className="form-control"
          style={{ paddingLeft: '2.5rem', backgroundColor: '#fff' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Shop Details</th>
                <th>Tenant</th>
                <th>Rent Due</th>
                <th>Amount Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeRentSales.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No shops with a monthly rent found for this criteria. Go to Sales & Allocations to set a monthly rent.</td></tr>
              ) : (
                activeRentSales.map(sale => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 500 }}>{getShopDetails(sale.shopId)}</td>
                    <td>{getTenantDetails(sale.tenantId)}</td>
                    <td>Rs. {sale.rentDue.toLocaleString()}</td>
                    <td style={{ color: sale.amountPaid > 0 ? '#10b981' : 'inherit' }}>
                      Rs. {sale.amountPaid.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: sale.balance > 0 ? '#ef4444' : '#10b981' }}>
                      Rs. {sale.balance.toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-badge ${
                        sale.status === 'Paid' ? 'status-completed' : 
                        sale.status === 'Partial' ? 'status-active' : 'status-pending'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        onClick={() => { setSelectedSale(sale); setIsModalOpen(true); }}
                        disabled={sale.status === 'Paid'}
                      >
                        <DollarSign size={14} /> Receive
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedSale && (
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setSelectedSale(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Receive Rent</h2>
              <button className="modal-close" onClick={() => { setIsModalOpen(false); setSelectedSale(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleReceiveRent}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Shop:</strong> {getShopDetails(selectedSale.shopId)}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}><strong>Tenant:</strong> {getTenantDetails(selectedSale.tenantId)}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#ef4444', fontWeight: 600 }}>
                  <strong>Balance Due:</strong> Rs. {selectedSale.balance.toLocaleString()}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount Paid</label>
                <input type="number" name="amount_paid" className="form-control" required min="1" step="0.01" max={selectedSale.balance} defaultValue={selectedSale.balance} />
              </div>
              <div className="form-group">
                <label className="form-label">Receipt / Reference No. (System Generated)</label>
                <input type="text" name="receipt_no" className="form-control" defaultValue={generateReceiptNo()} readOnly style={{ backgroundColor: 'var(--color-bg-app)', cursor: 'not-allowed', color: 'var(--color-text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input type="text" name="notes" className="form-control" placeholder="e.g. Paid in cash, Check #1234" />
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setSelectedSale(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
