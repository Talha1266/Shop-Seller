import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { Printer, FileText, Plus, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const LedgerPrint = ({ tenant, tenantSales, tenantShops, payments, totalAmount, totalPaid, balance, innerRef }) => {
  if (!tenant || tenantSales.length === 0) return <div ref={innerRef}></div>;

  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none' }} className="print-ledger-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          .print-ledger-wrapper { display: block !important; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        `}
      </style>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>Plaza Management</h1>
          <h2 style={{ margin: 0, color: '#555' }}>Statement of Account / Ledger</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Tenant Details</h3>
            <p style={{ margin: '5px 0' }}><strong>Name:</strong> {tenant.name}</p>
            <p style={{ margin: '5px 0' }}><strong>CNIC:</strong> {tenant.cnic}</p>
            <p style={{ margin: '5px 0' }}><strong>Mobile:</strong> {tenant.mobile}</p>
          </div>
          <div style={{ padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Portfolio Summary</h3>
            <p style={{ margin: '5px 0' }}><strong>Shops:</strong> {tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block}, Floor ${s.floor})`).join(', ')}</p>
            <p style={{ margin: '5px 0' }}><strong>Total Amount:</strong> Rs. {totalAmount.toLocaleString()}</p>
            <p style={{ margin: '5px 0' }}><strong>Advance Paid:</strong> Rs. {tenantSales.reduce((s, sale) => s + sale.advancePayment, 0).toLocaleString()}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '10px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
          <div><strong>Total Received:</strong> Rs. {totalPaid.toLocaleString()}</div>
          <div><strong style={{ color: '#b91c1c' }}>Remaining Balance:</strong> Rs. {balance.toLocaleString()}</div>
        </div>

        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px', marginTop: '20px' }}>Payment History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt No</th>
              <th>Shop</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {tenantSales.map(sale => {
              const shop = tenantShops.find(s => s.id === sale.shopId);
              return (
                <tr key={`adv-${sale.id}`}>
                  <td>{new Date(sale.date).toLocaleDateString()}</td>
                  <td>Advance</td>
                  <td>{shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : 'Unknown'}</td>
                  <td>Rs. {sale.advancePayment.toLocaleString()}</td>
                </tr>
              )
            })}
            {payments.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No additional payments recorded.</td></tr>
            ) : (
              payments.map((pmt, idx) => {
                const sale = tenantSales.find(s => s.id === pmt.saleId);
                const shop = sale ? tenantShops.find(s => s.id === sale.shopId) : null;
                return (
                  <tr key={pmt.id || idx}>
                    <td>{new Date(pmt.date).toLocaleDateString()}</td>
                    <td>{pmt.receiptNo || '-'}</td>
                    <td>{shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block}, Floor ${s.floor})`).join(', ') || 'Unknown'}</td>
                    <td>Rs. {pmt.amount.toLocaleString()}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>


        
        <div style={{ marginTop: '60px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
          This is a computer-generated statement and does not require a physical signature.
        </div>
      </div>
    </div>
  );
};

export default function Ledger() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState('tenant'); // 'tenant' or 'shop'
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (location.state?.tenantId) {
      setSearchMode('tenant');
      setSelectedId(location.state.tenantId.toString());
    }
  }, [location.state]);

  const tenants = useSupabase('tenants') || [];
  const sales = useSupabase('sales') || [];
  const shops = useSupabase('shops') || [];

  const payments = useSupabase('payments') || [];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  let tenant = null;
  let tenantSales = [];
  let tenantShops = [];
  
  if (selectedId) {
    if (searchMode === 'tenant') {
      const tId = selectedId;
      tenant = tenants.find(t => t.id === tId);
      if (tenant) {
        tenantSales = sales.filter(s => s.tenantId === tId);
        tenantShops = tenantSales.map(sale => shops.find(s => s.id === sale.shopId)).filter(Boolean);
      }
    } else if (searchMode === 'shop') {
      const sId = selectedId;
      const sale = sales.find(s => s.shopId === sId);
      if (sale) {
        tenant = tenants.find(t => t.id === sale.tenantId);
        if (tenant) {
          tenantSales = [sale]; // Only this specific sale/shop
          tenantShops = [shops.find(s => s.id === sId)].filter(Boolean);
        }
      }
    }
  }

  const saleIds = tenantSales.map(s => s.id);
  
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!tenant) return;
    const formData = new FormData(e.target);
    const newPayment = {
      tenantId: tenant.id,
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount')),
      receiptNo: `REC-${Date.now().toString().slice(-6)}`
    };
    
    await db.payments.add(newPayment);
    setIsPaymentModalOpen(false);
  };
  

    
  const tenantPayments = payments.filter(p => saleIds.includes(p.saleId) || (tenant && p.tenantId === tenant.id));

  const totalAmount = tenantSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalAdvance = tenantSales.reduce((sum, s) => sum + s.advancePayment, 0);
  const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0) + totalAdvance;
  const balance = totalAmount - totalPaid;

  return (
    <div>
      <LedgerPrint 
        innerRef={printRef}
        tenant={tenant}
        tenantSales={tenantSales}
        tenantShops={tenantShops}

        payments={tenantPayments}
        totalAmount={totalAmount}
        totalPaid={totalPaid}
        balance={balance}
      />

      <div className="page-header">
        <h1 className="page-title">Tenant Ledger & Statements</h1>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', maxWidth: searchMode === 'shop' ? '800px' : '600px' }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Search By</label>
            <select 
              className="form-control" 
              value={searchMode} 
              onChange={(e) => { 
                setSearchMode(e.target.value); 
                setSelectedId(''); 
                setSelectedBlock(''); 
              }}
            >
              <option value="tenant">Tenant Name</option>
              <option value="shop">Shop Number</option>
            </select>
          </div>
          
          {searchMode === 'shop' && (
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Select Block</label>
              <select 
                className="form-control" 
                value={selectedBlock} 
                onChange={(e) => { setSelectedBlock(e.target.value); setSelectedId(''); }}
              >
                <option value="">-- Select Block --</option>
                {Array.from(new Set(shops.filter(s => s.status === 'Occupied').map(s => s.block))).sort().map(block => (
                  <option key={block} value={block}>Block {block}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="form-group" style={{ margin: 0, flex: 2 }}>
            <label className="form-label">
              {searchMode === 'tenant' ? 'Select Tenant' : 'Select Allocated Shop'}
            </label>
            <select 
              className="form-control" 
              value={selectedId} 
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={searchMode === 'shop' && !selectedBlock}
            >
              <option value="">{searchMode === 'tenant' ? '-- Select Tenant --' : '-- Select Shop --'}</option>
              {searchMode === 'tenant' 
                ? tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.cnic})</option>)
                : shops.filter(s => s.status === 'Occupied' && s.block === selectedBlock).map(s => {
                    const sale = sales.find(x => x.shopId === s.id);
                    const t = sale ? tenants.find(x => x.id === sale.tenantId) : null;
                    return <option key={s.id} value={s.id}>Shop {s.shopNumber} (Block {s.block}) {t ? `(${t.name})` : ''}</option>
                  })
              }
            </select>
          </div>
        </div>
      </div>

      {tenant && tenantSales.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>{tenant.name}</h2>
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                {searchMode === 'tenant' && tenantShops.length > 1 ? 'Combined Ledger for: ' : 'Ledger for: '}
                {tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block})`).join(', ')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setIsPaymentModalOpen(true)}>
                <Plus size={18} /> Record Payment
              </button>
              <button className="btn btn-secondary" onClick={handlePrint}>
                <Printer size={18} /> Print Statement
              </button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', backgroundColor: 'var(--color-border)' }}>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Allocated Amount</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Rs. {totalAmount.toLocaleString()}</h3>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Received (inc. Advance)</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--color-success)' }}>Rs. {totalPaid.toLocaleString()}</h3>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Remaining Balance</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--color-warning-text)' }}>Rs. {balance.toLocaleString()}</h3>
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              Payment History
            </h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt No / Type</th>
                    <th>Shop</th>
                    <th>Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantSales.map(sale => {
                    const shop = tenantShops.find(s => s.id === sale.shopId);
                    return (
                      <tr key={`adv-${sale.id}`}>
                        <td>{new Date(sale.date).toLocaleDateString()}</td>
                        <td><span className="badge badge-secondary">Advance</span></td>
                        <td style={{ fontWeight: 500 }}>{shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : 'Unknown'}</td>
                        <td style={{ fontWeight: 500, color: '#10b981' }}>Rs. {sale.advancePayment.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                  {tenantPayments.map((pmt, idx) => {
                    const sale = tenantSales.find(s => s.id === pmt.saleId);
                    const shop = sale ? tenantShops.find(s => s.id === sale.shopId) : null;
                    return (
                      <tr key={pmt.id || idx}>
                        <td>{new Date(pmt.date).toLocaleDateString()}</td>
                        <td>{pmt.receiptNo || 'Payment'}</td>
                        <td style={{ fontWeight: 500 }}>{shop ? `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})` : tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block}, Floor ${s.floor})`).join(', ') || 'General Portfolio Payment'}</td>
                        <td style={{ fontWeight: 500, color: '#10b981' }}>Rs. {pmt.amount.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                  {tenantPayments.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No additional payments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : selectedId ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 500 }}>No Allocations Found</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>This search did not return any active shop allocations.</p>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 500 }}>Select a Record</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Use the search filters above to view a ledger by Tenant or by Shop.</p>
        </div>
      )}

      {isPaymentModalOpen && tenant && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Payment</h2>
              <button className="modal-close" onClick={() => setIsPaymentModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="form-group">
                <label className="form-label">Tenant</label>
                <input type="text" className="form-control" readOnly value={tenant.name} />
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
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
