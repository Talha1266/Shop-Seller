import { useState, useMemo, useRef, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { Plus, X, Search, DollarSign, Printer, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useProject } from '../contexts/ProjectContext';
const RentReceiptPrint = ({ printData, innerRef, projectName }) => {
  if (!printData) return <div ref={innerRef}></div>;

  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none' }} className="print-receipt-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          .print-receipt-wrapper { display: block !important; }
        `}
      </style>
      <div style={{ border: '2px solid #000', padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>{projectName || 'Plaza Management'}</h1>
          <h2 style={{ margin: 0, color: '#555' }}>Rent Receipt</h2>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div><strong>Receipt No:</strong> {printData.receipt_no}</div>
          <div><strong>Date:</strong> {new Date(printData.date).toLocaleDateString()}</div>
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
          <p style={{ margin: '5px 0' }}><strong>Received From:</strong> {printData.tenantName}</p>
          <p style={{ margin: '5px 0' }}><strong>Shop Details:</strong> {printData.shopDetails}</p>
          <p style={{ margin: '5px 0' }}><strong>For Month:</strong> {printData.month}</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'left', padding: '8px 0' }}>Description</th>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'right', padding: '8px 0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>Rent Payment</td>
              <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', textAlign: 'right' }}>Rs. {printData.rentAmount?.toLocaleString()}</td>
            </tr>
            {printData.fineAmount > 0 && (
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>Late Fine</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', textAlign: 'right' }}>Rs. {printData.fineAmount?.toLocaleString()}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '12px 0', fontWeight: 'bold' }}>Total Amount Paid</td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '1.2em' }}>Rs. {printData.amount_paid?.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '10px', width: '200px', textAlign: 'center' }}>
            Authorized Signature
          </div>
        </div>
        
        <div style={{ marginTop: '30px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
          Thank you for your payment!
        </div>
      </div>
    </div>
  );
};

export default function Rent({ currentUser }) {
  const db = useDb();
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistorySale, setSelectedHistorySale] = useState(null);

  const { activeProject } = useProject();
  const printRef = useRef(null);
  const [printData, setPrintData] = useState(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const triggerPrint = (data) => {
    setPrintData(data);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const calculateFine = (monthString, paymentDate) => {
    const [year, month] = monthString.split('-');
    const dueYear = parseInt(year);
    const dueMonthIndex = parseInt(month) - 1; 
    const dueDate = new Date(dueYear, dueMonthIndex, 10);
    const endOfMonth = new Date(dueYear, dueMonthIndex + 1, 0); 
    
    const payDate = new Date(paymentDate);
    payDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    endOfMonth.setHours(0, 0, 0, 0);

    if (payDate <= dueDate) return 0;
    
    const penaltyEndDate = payDate > endOfMonth ? endOfMonth : payDate;
    const diffTime = penaltyEndDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays > 0 ? diffDays * 100 : 0;
  };

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

    const currentFine = calculateFine(selectedMonthString, paymentDate);
    const receiptNo = formData.get('receipt_no') || generateReceiptNo();

    // Notes can include fine info if we don't strictly have a fine column
    let notes = formData.get('notes') || '';
    if (currentFine > 0) {
      notes = `Includes Rs. ${currentFine} late fine. ` + notes;
    }

    const newPayment = {
      sale_id: selectedSale.id,
      month: selectedMonthString,
      amount_paid: amount > selectedSale.balance && currentFine > 0 ? selectedSale.balance : amount, // allocate to base rent first
      fine_amount: amount > selectedSale.balance && currentFine > 0 ? amount - selectedSale.balance : 0,
      date: formData.get('date'),
      receipt_no: receiptNo,
      notes: notes
    };

    try {
      await db.rent_collections.add(newPayment);
      
      triggerPrint({
        receipt_no: receiptNo,
        date: formData.get('date'),
        tenantName: getTenantDetails(selectedSale.tenantId),
        shopDetails: getShopDetails(selectedSale.shopId),
        month: selectedMonthString,
        rentAmount: selectedSale.balance, // This assumes they are paying off the remaining balance
        fineAmount: currentFine,
        amount_paid: amount
      });

      setIsModalOpen(false);
      setSelectedSale(null);
    } catch (err) {
      alert("Error saving rent payment: " + err.message);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) return;
    try {
      await db.rent_collections.delete(paymentId);
    } catch (err) {
      alert("Error deleting payment: " + err.message);
    }
  };

  const generateReceiptNo = () => {
    return 'REC-' + Math.floor(100000 + Math.random() * 900000).toString();
  };

  return (
    <div>
      <RentReceiptPrint 
        printData={printData}
        innerRef={printRef}
        projectName={activeProject?.name}
      />
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
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {sale.amountPaid > 0 && (
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                            onClick={() => { setSelectedHistorySale(sale); setIsHistoryModalOpen(true); }}
                          >
                            History
                          </button>
                        )}
                        <button 
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          onClick={() => { setSelectedSale(sale); setPaymentDate(new Date().toISOString().split('T')[0]); setIsModalOpen(true); }}
                          disabled={sale.status === 'Paid'}
                        >
                          <DollarSign size={14} /> Receive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedSale && (() => {
        const currentFine = calculateFine(selectedMonthString, paymentDate);
        const totalDue = selectedSale.balance + currentFine;
        
        return (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Base Rent Due:</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Rs. {selectedSale.balance.toLocaleString()}</p>
                  </div>
                  {currentFine > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#ef4444' }}>Late Fine:</p>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#ef4444' }}>Rs. {currentFine.toLocaleString()}</p>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold' }}>Total Payable:</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold', color: '#10b981' }}>Rs. {totalDue.toLocaleString()}</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input type="date" name="date" className="form-control" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid</label>
                  <input key={totalDue} type="number" name="amount_paid" className="form-control" required min="1" step="0.01" defaultValue={totalDue} />
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
                  <button type="submit" className="btn btn-primary">Save Payment & Print</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {isHistoryModalOpen && selectedHistorySale && (() => {
        const historyPayments = rentCollections.filter(rc => rc.sale_id === selectedHistorySale.id && rc.month === selectedMonthString);
        return (
          <div className="modal-overlay" onClick={() => { setIsHistoryModalOpen(false); setSelectedHistorySale(null); }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <div className="modal-header">
                <h2 className="modal-title">Payment History for {selectedMonthString}</h2>
                <button className="modal-close" onClick={() => { setIsHistoryModalOpen(false); setSelectedHistorySale(null); }}><X size={24} /></button>
              </div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Shop:</strong> {getShopDetails(selectedHistorySale.shopId)}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}><strong>Tenant:</strong> {getTenantDetails(selectedHistorySale.tenantId)}</p>
              </div>
              
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt No</th>
                      <th>Base Rent</th>
                      <th>Fine</th>
                      <th>Total</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPayments.map(pmt => {
                      const totalAmt = parseFloat(pmt.amount_paid || 0) + parseFloat(pmt.fine_amount || 0);
                      return (
                        <tr key={pmt.id}>
                          <td>{new Date(pmt.date).toLocaleDateString()}</td>
                          <td>{pmt.receipt_no}</td>
                          <td>Rs. {parseFloat(pmt.amount_paid || 0).toLocaleString()}</td>
                          <td style={{ color: pmt.fine_amount > 0 ? '#ef4444' : 'inherit' }}>
                            Rs. {parseFloat(pmt.fine_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600 }}>Rs. {totalAmt.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button 
                                className="icon-btn" 
                                style={{ color: 'var(--color-primary)' }}
                                title="Print Receipt"
                                onClick={() => triggerPrint({
                                  receipt_no: pmt.receipt_no,
                                  date: pmt.date,
                                  tenantName: getTenantDetails(selectedHistorySale.tenantId),
                                  shopDetails: getShopDetails(selectedHistorySale.shopId),
                                  month: selectedMonthString,
                                  rentAmount: parseFloat(pmt.amount_paid || 0),
                                  fineAmount: parseFloat(pmt.fine_amount || 0),
                                  amount_paid: totalAmt
                                })}
                              >
                                <Printer size={16} />
                              </button>
                              <button 
                                className="icon-btn" 
                                style={{ color: '#ef4444' }}
                                title="Undo Payment"
                                onClick={() => handleDeletePayment(pmt.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {historyPayments.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No payments found for this month.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
