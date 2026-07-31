import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X, Printer, Edit, Lock, LockOpen, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

// Receipt component for printing
const ReceiptPrint = ({ payment, tenantShops, tenant, innerRef }) => {
  if (!payment) return <div ref={innerRef}></div>;
  
  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none' }} className="print-receipt-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto;  margin: 0mm; }
          .print-receipt-wrapper { display: block !important; }
        `}
      </style>
      <div style={{ border: '2px solid #000', padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>Plaza Management</h1>
          <h2 style={{ margin: 0, color: '#555' }}>Payment Receipt</h2>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div><strong>Receipt No:</strong> {payment.receiptNo}</div>
          <div><strong>Date:</strong> {new Date(payment.date).toLocaleDateString()}</div>
        </div>

        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Received From</h3>
          <p style={{ margin: '5px 0' }}><strong>Name:</strong> {tenant?.name}</p>
          <p style={{ margin: '5px 0' }}><strong>CNIC:</strong> {tenant?.cnic}</p>
          <p style={{ margin: '5px 0' }}><strong>Mobile:</strong> {tenant?.mobile}</p>
        </div>

        <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Payment Details</h3>
          <p style={{ margin: '5px 0' }}><strong>Portfolio Details:</strong> {tenantShops?.map(s => `Shop ${s.shopNumber} (Block ${s.block}, Floor ${s.floor})`).join(', ')}</p>
          <p style={{ margin: '5px 0' }}><strong>Amount Paid:</strong> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Rs. {payment.amount.toLocaleString()}</span></p>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', textAlign: 'center', paddingTop: '10px' }}>
            Authorized Signature
          </div>
          <div style={{ borderTop: '1px solid #000', width: '200px', textAlign: 'center', paddingTop: '10px' }}>
            Tenant Signature
          </div>
        </div>
      </div>
    </div>
  );
};


export default function Payments({ currentUser }) {
  const db = useDb();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState(null);
  const [printPaymentId, setPrintPaymentId] = useState(null);
  const [preSelectedTenantId, setPreSelectedTenantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const handleUnlock = () => {
    const code = window.prompt("SAFETY LOCK ACTIVE\n\nTo unlock payment edits, type 'CONFIRM':");
    if (code === 'CONFIRM') {
      setIsUnlocked(true);
    } else if (code !== null) {
      alert("Invalid code. System remains locked.");
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
  };

  useEffect(() => {
    if (location.state?.preSelectTenantId) {
      setPreSelectedTenantId(location.state.preSelectTenantId.toString());
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  const printRef = useRef(null);

  const payments = useSupabase('payments') || [];
  const sales = useSupabase('sales') || [];
  const shops = useSupabase('shops') || [];
  const tenants = useSupabase('tenants') || [];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const triggerPrint = (paymentId) => {
    setPrintPaymentId(paymentId);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tenantId = formData.get('tenantId');
    const newPayment = {
      tenantId: tenantId,
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount')),
      receiptNo: formData.get('receiptNo') || 'XXXX'
    };
    
    await db.payments.add(newPayment);
    setIsModalOpen(false);
  };

  const handleEditReceipt = async (payment) => {
    if (!isUnlocked) return;
    const newReceipt = window.prompt("Enter new receipt number:", payment.receiptNo);
    if (newReceipt !== null && newReceipt.trim() !== "" && newReceipt !== payment.receiptNo) {
      try {
        await db.payments.update(payment.id, { receiptNo: newReceipt.trim() });
      } catch (err) {
        alert("Failed to update receipt number: " + err.message);
      }
    }
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    const date = formData.get('date');
    
    if (selectedPaymentForEdit.isAdvance) {
      await db.sales.update(selectedPaymentForEdit.saleId, {
        advancePayment: amount,
        date: date
      });
    } else {
      await db.payments.update(selectedPaymentForEdit.id, {
        amount,
        date
      });
    }
    
    setIsEditModalOpen(false);
    setSelectedPaymentForEdit(null);
  };

  const getPaymentDetails = (payment) => {
    if (!payment) return null;
    let tenant;
    if (payment.tenantId) {
      tenant = tenants.find(t => t.id === payment.tenantId);
    } else if (payment.saleId) {
      const sale = sales.find(s => s.id === payment.saleId);
      if (sale) {
        tenant = tenants.find(t => t.id === sale.tenantId);
      }
    }
    if (!tenant) return null;
    
    const tenantSales = sales.filter(s => s.tenantId === tenant.id);
    const tenantShops = tenantSales.map(sale => shops.find(s => s.id === sale.shopId)).filter(Boolean);
    
    return { tenant, tenantShops };
  };

  // Only show payments linked to tenants who have an active (occupied) shop
  const occupiedShopIds = new Set(shops.filter(s => s.status === 'Occupied').map(s => s.id));
  const activeSalesByShop = sales.filter(s => occupiedShopIds.has(s.shopId));
  const validTenantIds = new Set(activeSalesByShop.map(s => s.tenantId).filter(Boolean));
  const validSaleIds = new Set(activeSalesByShop.map(s => s.id));

  const advancePayments = sales
    .filter(s => parseFloat(s.advancePayment || 0) > 0)
    .map(s => ({
      id: `adv-${s.id}`,
      saleId: s.id,
      tenantId: s.tenantId,
      receiptNo: 'ADVANCE',
      date: s.date || new Date().toISOString(),
      amount: parseFloat(s.advancePayment || 0),
      isAdvance: true
    }));

  const allPayments = [...payments, ...advancePayments];

  const filteredPayments = allPayments.filter(p =>
    (p.tenantId && validTenantIds.has(p.tenantId)) ||
    (p.saleId && validSaleIds.has(p.saleId))
  ).filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const details = getPaymentDetails(p);
    const tenantName = details?.tenant?.name?.toLowerCase() || '';
    const receipt = p.receiptNo?.toLowerCase() || '';
    return tenantName.includes(q) || receipt.includes(q);
  });

  const activeSales = sales.filter(s => !s.isCompleted && occupiedShopIds.has(s.shopId));
  const activeTenants = Array.from(new Set(activeSales.map(s => s.tenantId)))
    .map(tId => tenants.find(t => t.id === tId))
    .filter(Boolean);


  // For printing the currently selected payment
  const printData = printPaymentId ? allPayments.find(p => p.id === printPaymentId) : null;
  const printPaymentDetails = getPaymentDetails(printData);

  return (
    <div>
      {/* Hidden print area */}
      <ReceiptPrint 
        innerRef={printRef}
        payment={printData} 
        tenantShops={printPaymentDetails?.tenantShops} 
        tenant={printPaymentDetails?.tenant} 
      />

      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
        <h1 className="page-title">Installment Payments</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search tenant or receipt..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '35px', minWidth: '250px' }}
            />
          </div>
          {currentUser?.isAdmin && (
            <button 
              className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`} 
              onClick={isUnlocked ? handleLock : handleUnlock}
              style={isUnlocked ? { backgroundColor: '#f1f5f9', color: '#475569' } : { backgroundColor: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
            >
              {isUnlocked ? <><LockOpen size={18} /> Edits Unlocked</> : <><Lock size={18} /> Unlock Edits</>}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Record Payment
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Tenant</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No payments recorded yet.</td></tr>
              ) : (
                filteredPayments.map(payment => {
                  const details = getPaymentDetails(payment);
                  return (
                    <tr key={payment.id}>
                      <td 
                        style={{ fontWeight: 500, color: (isUnlocked && !payment.isAdvance) ? 'var(--color-primary)' : 'var(--color-text)', cursor: (isUnlocked && !payment.isAdvance) ? 'pointer' : 'default', textDecoration: (isUnlocked && !payment.isAdvance) ? 'underline dashed' : 'none' }} 
                        onClick={() => { if (!payment.isAdvance) handleEditReceipt(payment); }}
                        title={(isUnlocked && !payment.isAdvance) ? "Click to edit receipt number" : ""}
                      >
                        {payment.receiptNo}
                        {payment.isAdvance && <span style={{ marginLeft: '8px', fontSize: '0.65rem', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '12px' }}>Registration</span>}
                      </td>
                      <td>{new Date(payment.date).toLocaleDateString()}</td>
                      <td>{details?.tenant?.name || 'N/A'}</td>
                      <td>{details?.tenantShops ? details.tenantShops.map(s => `Shop ${s.shopNumber}`).join(', ') : 'N/A'}</td>
                      <td style={{ fontWeight: 600 }}>Rs. {payment.amount.toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => triggerPrint(payment.id)}>
                          <Printer size={16} /> Print
                        </button>
                        {isUnlocked && (
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: '#d97706', borderColor: '#fef3c7', backgroundColor: '#fffbeb' }} onClick={() => { setSelectedPaymentForEdit(payment); setIsEditModalOpen(true); }}>
                            <Edit size={16} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Installment Payment</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="form-group">
                <label className="form-label">Select Tenant</label>
                <select name="tenantId" className="form-control" required value={preSelectedTenantId} onChange={e => setPreSelectedTenantId(e.target.value)}>
                  <option value="">-- Select Active Tenant --</option>
                  {activeTenants.map(tenant => {
                    const tSales = sales.filter(s => s.tenantId === tenant.id && !s.isCompleted);
                    const tShops = tSales.map(s => shops.find(sh => sh.id === s.shopId)).filter(Boolean);
                    return (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} - Shops: {tShops.map(s => s.shopNumber).join(', ')}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Receipt No.</label>
                <input type="text" name="receiptNo" className="form-control" placeholder="Leave empty to default to XXXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount Received</label>
                <input type="number" name="amount" className="form-control" required min="1" step="0.01" />
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={activeSales.length === 0}>
                  Save Payment
                </button>
              </div>
              {activeSales.length === 0 && (
                <p style={{ color: 'var(--color-warning-text)', fontSize: '0.875rem', marginTop: '1rem', textAlign: 'center' }}>
                  No active allocations found. Please create a sale first.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedPaymentForEdit && (
        <div className="modal-overlay" onClick={() => { setIsEditModalOpen(false); setSelectedPaymentForEdit(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Payment</h2>
              <button className="modal-close" onClick={() => { setIsEditModalOpen(false); setSelectedPaymentForEdit(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleEditPaymentSubmit}>
              <div className="form-group">
                <label className="form-label">Receipt No.</label>
                <input type="text" className="form-control" disabled value={selectedPaymentForEdit.receiptNo} />
                {selectedPaymentForEdit.isAdvance && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>This is a shop registration advance. Receipt number cannot be changed.</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date(selectedPaymentForEdit.date).toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input type="number" name="amount" className="form-control" required min="1" step="0.01" defaultValue={selectedPaymentForEdit.amount} />
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsEditModalOpen(false); setSelectedPaymentForEdit(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
