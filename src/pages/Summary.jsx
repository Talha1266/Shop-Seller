import { useRef, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { Printer, PieChart } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function Summary() {
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const tenants = useSupabase('tenants') || [];
  const payments = useSupabase('payments') || [];
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Block Summary Report',
  });

  const blockSummaries = useMemo(() => {
    if (!shops.length || !sales.length || !tenants.length) return [];

    // 1. Calculate computed balance for every sale by distributing tenant payments sequentially
    const computedSales = [...sales];
    
    tenants.forEach(tenant => {
      // Find all sales for this tenant
      const tenantSales = computedSales.filter(s => s.tenantId === tenant.id);
      
      // Find all payments for this tenant
      const tenantPayments = payments.filter(p => 
        p.tenantId === tenant.id || tenantSales.some(ts => ts.id === p.saleId)
      );
      
      // Total amount paid by tenant (including advances)
      let remainingPaymentToDistribute = 
        tenantPayments.reduce((sum, p) => sum + p.amount, 0) + 
        tenantSales.reduce((sum, sale) => sum + (sale.advancePayment || 0), 0);

      // Sort sales by ID to ensure consistent sequential distribution
      tenantSales.sort((a, b) => a.id - b.id);
      
      // Distribute payment sequentially
      tenantSales.forEach(sale => {
        const amountDue = sale.totalAmount || 0;
        const paidForThisSale = Math.min(remainingPaymentToDistribute, amountDue);
        remainingPaymentToDistribute -= paidForThisSale;
        
        // Attach the remaining unpaid balance to the sale object
        sale.computedBalance = amountDue - paidForThisSale;
      });
    });

    // 2. Aggregate data by Block
    const blocks = Array.from(new Set(shops.map(s => s.block))).sort();
    
    return blocks.map(block => {
      const blockShops = shops.filter(s => s.block === block);
      const totalShops = blockShops.length;
      const vacantShops = blockShops.filter(s => s.status === 'Vacant').length;
      const occupiedShops = blockShops.filter(s => s.status === 'Occupied').length;
      
      const blockSales = computedSales.filter(sale => {
        const shop = blockShops.find(s => s.id === sale.shopId);
        return !!shop;
      });

      const totalAllocatedValue = blockSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      const pendingBalance = blockSales.reduce((sum, sale) => sum + (sale.computedBalance || 0), 0);

      return {
        block,
        totalShops,
        vacantShops,
        occupiedShops,
        totalAllocatedValue,
        pendingBalance
      };
    });
  }, [shops, sales, tenants, payments]);

  if (!shops.length && !sales.length && !tenants.length) {
    return <div style={{ padding: '2rem' }}>Loading summary data...</div>;
  }

  // Totals for the footer
  const grandTotalShops = blockSummaries.reduce((sum, b) => sum + b.totalShops, 0);
  const grandVacant = blockSummaries.reduce((sum, b) => sum + b.vacantShops, 0);
  const grandOccupied = blockSummaries.reduce((sum, b) => sum + b.occupiedShops, 0);
  const grandValue = blockSummaries.reduce((sum, b) => sum + b.totalAllocatedValue, 0);
  const grandPending = blockSummaries.reduce((sum, b) => sum + b.pendingBalance, 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Block Summary Report</h1>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={18} /> Print Report
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Total Shops</th>
                <th>Vacant Shops</th>
                <th>Occupied Shops</th>
                <th>Total Allocated Value</th>
                <th>Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              {blockSummaries.map((summary) => (
                <tr key={summary.block} className="hoverable-row">
                  <td><strong>Block {summary.block}</strong></td>
                  <td>{summary.totalShops}</td>
                  <td><span style={{ color: summary.vacantShops > 0 ? 'var(--color-primary)' : 'inherit' }}>{summary.vacantShops}</span></td>
                  <td>{summary.occupiedShops}</td>
                  <td>Rs. {summary.totalAllocatedValue.toLocaleString()}</td>
                  <td><strong style={{ color: summary.pendingBalance > 0 ? '#b91c1c' : 'inherit' }}>Rs. {summary.pendingBalance.toLocaleString()}</strong></td>
                </tr>
              ))}
              {blockSummaries.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No shop or sales data available yet.</td>
                </tr>
              )}
            </tbody>
            {blockSummaries.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                  <td>GRAND TOTAL</td>
                  <td>{grandTotalShops}</td>
                  <td>{grandVacant}</td>
                  <td>{grandOccupied}</td>
                  <td>Rs. {grandValue.toLocaleString()}</td>
                  <td><strong style={{ color: '#b91c1c' }}>Rs. {grandPending.toLocaleString()}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Hidden Print Layout */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
          <style type="text/css" media="print">
            {`
              @page { size: A4 portrait; margin: 20mm; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              tfoot td { background-color: #f9f9f9; font-weight: bold; }
            `}
          </style>
          
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>Plaza Management</h1>
            <h2 style={{ margin: 0, color: '#555' }}>Block Summary Report</h2>
            <p style={{ margin: '10px 0 0 0', color: '#777' }}>Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Total Shops</th>
                <th>Vacant Shops</th>
                <th>Occupied Shops</th>
                <th>Total Allocated Value</th>
                <th>Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              {blockSummaries.map((summary) => (
                <tr key={summary.block}>
                  <td><strong>Block {summary.block}</strong></td>
                  <td>{summary.totalShops}</td>
                  <td>{summary.vacantShops}</td>
                  <td>{summary.occupiedShops}</td>
                  <td>Rs. {summary.totalAllocatedValue.toLocaleString()}</td>
                  <td>Rs. {summary.pendingBalance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {blockSummaries.length > 0 && (
              <tfoot>
                <tr>
                  <td>GRAND TOTAL</td>
                  <td>{grandTotalShops}</td>
                  <td>{grandVacant}</td>
                  <td>{grandOccupied}</td>
                  <td>Rs. {grandValue.toLocaleString()}</td>
                  <td>Rs. {grandPending.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
