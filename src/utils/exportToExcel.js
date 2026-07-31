import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';

export async function exportAllDataToExcel(projectId, projectName) {
  // 1. Fetch data
  const [
    { data: shops },
    { data: tenants },
    { data: sales },
    { data: payments },
    { data: contractors },
    { data: contractorPayments }
  ] = await Promise.all([
    supabase.from('shops').select('*').eq('project_id', projectId),
    supabase.from('tenants').select('*').eq('project_id', projectId),
    supabase.from('sales').select('*').eq('project_id', projectId),
    supabase.from('payments').select('*').eq('project_id', projectId),
    supabase.from('contractors').select('*').eq('project_id', projectId),
    supabase.from('contractor_payments').select('*').eq('project_id', projectId),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plaza Management System';
  workbook.lastModifiedBy = 'Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper for formatting header row
  const styleHeader = (worksheet, headers) => {
    worksheet.columns = headers.map(h => ({ header: h.label, key: h.key, width: h.width || 15 }));
    const row = worksheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.commit();
  };

  // ----- Sheet 1: Shops & Sales -----
  const wsShops = workbook.addWorksheet('Shops & Sales');
  styleHeader(wsShops, [
    { label: 'Shop No.', key: 'shopNo', width: 12 },
    { label: 'Block', key: 'block', width: 10 },
    { label: 'Floor', key: 'floor', width: 15 },
    { label: 'Listed Price', key: 'price', width: 20 },
    { label: 'Status', key: 'status', width: 15 },
    { label: 'Tenant Name', key: 'tenant', width: 25 },
    { label: 'Sale Amount', key: 'saleAmt', width: 20 },
    { label: 'Paid Amount', key: 'paidAmt', width: 20 },
    { label: 'Pending Bal.', key: 'pending', width: 20 },
  ]);

  let shopRow = 2;
  const sortedShops = [...(shops||[])].sort((a,b) => a.block.localeCompare(b.block) || a.shopNumber.localeCompare(b.shopNumber, undefined, {numeric: true}));

  for (const shop of sortedShops) {
    const sale = (sales||[]).find(s => s.shopId === shop.id);
    const tenant = sale ? (tenants||[]).find(t => t.id === sale.tenantId) : null;
    
    let allocatedAmount = 0;
    let paidAmount = 0;
    
    if (sale) {
      allocatedAmount = parseFloat(sale.totalAmount || 0);
      
      const tenantSales = (sales||[]).filter(s => s.tenantId === sale.tenantId).sort((a,b) => String(a.id).localeCompare(String(b.id)));
      const tenantPayments = (payments||[]).filter(p => p.tenantId === sale.tenantId || tenantSales.some(ts => ts.id === p.saleId));
      const totalPaymentPool = tenantPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      let remainingPool = totalPaymentPool;
      for (const ts of tenantSales) {
        let saleTotal = parseFloat(ts.totalAmount || 0);
        let advance = parseFloat(ts.advancePayment || 0);
        let saleOwed = saleTotal - advance;
        let amountPaidFromPool = Math.min(saleOwed, remainingPool);
        remainingPool -= amountPaidFromPool;
        
        if (ts.id === sale.id) {
          paidAmount = amountPaidFromPool + advance;
          break;
        }
      }
    }

    const row = wsShops.addRow({
      shopNo: shop.shopNumber,
      block: shop.block,
      floor: shop.floor,
      price: parseFloat(shop.price || 0),
      status: shop.status,
      tenant: tenant ? tenant.name : 'N/A',
      saleAmt: allocatedAmount > 0 ? allocatedAmount : 0,
      paidAmt: paidAmount,
    });
    
    // Formula for Pending: Sale Amt - Paid Amt (G2 - H2)
    if (allocatedAmount > 0) {
      row.getCell('pending').value = { formula: `G${shopRow}-H${shopRow}`, result: allocatedAmount - paidAmount };
    } else {
      row.getCell('pending').value = 0;
    }
    
    row.getCell('price').numFmt = '"Rs." #,##0.00';
    row.getCell('saleAmt').numFmt = '"Rs." #,##0.00';
    row.getCell('paidAmt').numFmt = '"Rs." #,##0.00';
    row.getCell('pending').numFmt = '"Rs." #,##0.00';
    
    shopRow++;
  }

  // Totals Row
  const totalRow = wsShops.addRow({
    shopNo: 'TOTAL',
  });
  totalRow.font = { bold: true };
  if (shopRow > 2) {
    totalRow.getCell('price').value = { formula: `SUM(D2:D${shopRow-1})` };
    totalRow.getCell('saleAmt').value = { formula: `SUM(G2:G${shopRow-1})` };
    totalRow.getCell('paidAmt').value = { formula: `SUM(H2:H${shopRow-1})` };
    totalRow.getCell('pending').value = { formula: `SUM(I2:I${shopRow-1})` };
  }
  totalRow.getCell('price').numFmt = '"Rs." #,##0.00';
  totalRow.getCell('saleAmt').numFmt = '"Rs." #,##0.00';
  totalRow.getCell('paidAmt').numFmt = '"Rs." #,##0.00';
  totalRow.getCell('pending').numFmt = '"Rs." #,##0.00';


  // ----- Sheet 2: Installment Payments -----
  const wsPayments = workbook.addWorksheet('Installment Payments');
  styleHeader(wsPayments, [
    { label: 'Receipt No.', key: 'receipt', width: 15 },
    { label: 'Date', key: 'date', width: 15 },
    { label: 'Tenant Name', key: 'tenant', width: 25 },
    { label: 'Amount', key: 'amount', width: 20 },
  ]);

  let paymentRow = 2;
  const sortedPayments = [...(payments||[])].sort((a,b) => new Date(a.date) - new Date(b.date));
  for (const p of sortedPayments) {
    const tenantId = p.tenantId || ((sales||[]).find(s => s.id === p.saleId)?.tenantId);
    const tenant = (tenants||[]).find(t => t.id === tenantId);
    
    const row = wsPayments.addRow({
      receipt: p.receiptNo || 'N/A',
      date: new Date(p.date).toLocaleDateString(),
      tenant: tenant ? tenant.name : 'Unknown',
      amount: parseFloat(p.amount || 0)
    });
    row.getCell('amount').numFmt = '"Rs." #,##0.00';
    paymentRow++;
  }

  const pTotalRow = wsPayments.addRow({ tenant: 'TOTAL' });
  pTotalRow.font = { bold: true };
  if (paymentRow > 2) {
    pTotalRow.getCell('amount').value = { formula: `SUM(D2:D${paymentRow-1})` };
  }
  pTotalRow.getCell('amount').numFmt = '"Rs." #,##0.00';


  // ----- Sheet 3: Tenants -----
  const wsTenants = workbook.addWorksheet('Tenants Directory');
  styleHeader(wsTenants, [
    { label: 'Name', key: 'name', width: 25 },
    { label: 'CNIC', key: 'cnic', width: 20 },
    { label: 'Mobile', key: 'mobile', width: 15 },
    { label: 'Email', key: 'email', width: 25 },
    { label: 'Address', key: 'address', width: 35 },
    { label: 'Emergency Contact', key: 'emergency', width: 20 },
  ]);
  for (const t of (tenants||[])) {
    wsTenants.addRow({
      name: t.name,
      cnic: t.cnic,
      mobile: t.mobile,
      email: t.email,
      address: t.address,
      emergency: t.emergencyContact
    });
  }


  // ----- Sheet 4: Contractors -----
  const wsContractors = workbook.addWorksheet('Contractors');
  styleHeader(wsContractors, [
    { label: 'Contractor Name', key: 'name', width: 25 },
    { label: 'Trade/Specialty', key: 'trade', width: 20 },
    { label: 'Phone', key: 'phone', width: 15 },
    { label: 'Total Budget', key: 'budget', width: 20 },
    { label: 'Total Paid', key: 'paid', width: 20 },
    { label: 'Balance Due', key: 'balance', width: 20 },
  ]);

  let cRow = 2;
  for (const c of (contractors||[])) {
    const cPayments = (contractorPayments||[]).filter(p => p.contractor_id === c.id);
    const paidSum = cPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid||0), 0);
    
    const row = wsContractors.addRow({
      name: c.name,
      trade: c.trade,
      phone: c.phone,
      budget: parseFloat(c.total_budget || 0),
      paid: paidSum,
    });
    
    row.getCell('balance').value = { formula: `D${cRow}-E${cRow}`, result: parseFloat(c.total_budget || 0) - paidSum };
    
    row.getCell('budget').numFmt = '"Rs." #,##0.00';
    row.getCell('paid').numFmt = '"Rs." #,##0.00';
    row.getCell('balance').numFmt = '"Rs." #,##0.00';
    
    cRow++;
  }

  const cTotalRow = wsContractors.addRow({ phone: 'TOTAL' });
  cTotalRow.font = { bold: true };
  if (cRow > 2) {
    cTotalRow.getCell('budget').value = { formula: `SUM(D2:D${cRow-1})` };
    cTotalRow.getCell('paid').value = { formula: `SUM(E2:E${cRow-1})` };
    cTotalRow.getCell('balance').value = { formula: `SUM(F2:F${cRow-1})` };
  }
  cTotalRow.getCell('budget').numFmt = '"Rs." #,##0.00';
  cTotalRow.getCell('paid').numFmt = '"Rs." #,##0.00';
  cTotalRow.getCell('balance').numFmt = '"Rs." #,##0.00';


  // ----- Sheet 5: Contractor Payments -----
  const wsCPayments = workbook.addWorksheet('Contractor Payments');
  styleHeader(wsCPayments, [
    { label: 'Date', key: 'date', width: 15 },
    { label: 'Contractor Name', key: 'name', width: 25 },
    { label: 'Amount Paid', key: 'amount', width: 20 },
    { label: 'Notes', key: 'notes', width: 35 },
  ]);
  
  let cpRow = 2;
  const sortedCPayments = [...(contractorPayments||[])].sort((a,b) => new Date(a.payment_date) - new Date(b.payment_date));
  for (const cp of sortedCPayments) {
    const contractor = (contractors||[]).find(c => c.id === cp.contractor_id);
    const row = wsCPayments.addRow({
      date: new Date(cp.payment_date).toLocaleDateString(),
      name: contractor ? contractor.name : 'Unknown',
      amount: parseFloat(cp.amount_paid || 0),
      notes: cp.notes || ''
    });
    row.getCell('amount').numFmt = '"Rs." #,##0.00';
    cpRow++;
  }
  
  const cpTotalRow = wsCPayments.addRow({ name: 'TOTAL' });
  cpTotalRow.font = { bold: true };
  if (cpRow > 2) {
    cpTotalRow.getCell('amount').value = { formula: `SUM(C2:C${cpRow-1})` };
  }
  cpTotalRow.getCell('amount').numFmt = '"Rs." #,##0.00';

  // ----- Finalize & Download -----
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const cleanProjectName = (projectName || 'Project').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `${cleanProjectName}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}
