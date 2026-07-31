import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';

export async function exportAllDataToExcel(projectId, projectName) {
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

  const styleHeader = (worksheet, headers, bgColor = 'FF4F46E5') => {
    worksheet.columns = headers.map(h => ({ header: h.label, key: h.key, width: h.width || 15 }));
    const row = worksheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 25;
    row.commit();
  };

  const setCurrency = (cell) => {
    cell.numFmt = '"Rs." #,##0.00';
  };

  // ----- 1. Project Dashboard -----
  const wsOverview = workbook.addWorksheet('1. Dashboard Overview');
  wsOverview.getColumn('A').width = 35;
  wsOverview.getColumn('B').width = 25;
  
  wsOverview.mergeCells('A1:B1');
  const titleCell = wsOverview.getCell('A1');
  titleCell.value = `${projectName || 'Project'} - Executive Summary`;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  wsOverview.getRow(1).height = 40;

  let totalShopValue = 0;
  let totalSaleValue = 0;
  let totalPaymentsReceived = 0;
  
  (shops || []).forEach(s => totalShopValue += parseFloat(s.price || 0));
  (sales || []).forEach(s => totalSaleValue += parseFloat(s.totalAmount || 0));
  (payments || []).forEach(p => totalPaymentsReceived += parseFloat(p.amount || 0));
  
  const metrics = [
    ['Total Shops', (shops || []).length],
    ['Occupied Shops (Sold)', (shops || []).filter(s => s.status === 'Occupied').length],
    ['Available Shops', (shops || []).filter(s => s.status === 'Available').length],
    ['Total Base Value (All Shops)', totalShopValue],
    ['Total Sale Value (Sold Shops Only)', totalSaleValue],
    ['Total Payments Received', totalPaymentsReceived],
    ['Outstanding Balance (Sold Shops)', totalSaleValue - totalPaymentsReceived],
  ];

  metrics.forEach((metric, index) => {
    const row = wsOverview.addRow({ A: metric[0], B: metric[1] });
    row.font = { size: 12 };
    if (index >= 3) {
      setCurrency(row.getCell('B'));
    }
  });


  // ----- 2. Master Shop Register -----
  const wsShops = workbook.addWorksheet('2. Master Shop Register');
  styleHeader(wsShops, [
    { label: 'Shop No.', key: 'shopNo', width: 12 },
    { label: 'Block', key: 'block', width: 10 },
    { label: 'Floor', key: 'floor', width: 15 },
    { label: 'Side', key: 'side', width: 12 },
    { label: 'Status', key: 'status', width: 15 },
    { label: 'Tenant Name', key: 'tenant', width: 25 },
    { label: 'Tenant Mobile', key: 'mobile', width: 18 },
    { label: 'Base Price', key: 'price', width: 20 },
    { label: 'Final Sale Price', key: 'saleAmt', width: 20 },
    { label: 'Amount Paid', key: 'paidAmt', width: 20 },
    { label: 'Balance Due', key: 'pending', width: 20 },
  ], 'FF2563EB'); // Blue

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
      side: shop.side || 'Front',
      status: shop.status,
      tenant: tenant ? tenant.name : 'N/A',
      mobile: tenant ? tenant.mobile : 'N/A',
      price: parseFloat(shop.price || 0),
      saleAmt: allocatedAmount > 0 ? allocatedAmount : 0,
      paidAmt: paidAmount,
    });
    
    if (allocatedAmount > 0) {
      row.getCell('pending').value = { formula: `I${shopRow}-J${shopRow}`, result: allocatedAmount - paidAmount };
    } else {
      row.getCell('pending').value = 0;
    }
    
    setCurrency(row.getCell('price'));
    setCurrency(row.getCell('saleAmt'));
    setCurrency(row.getCell('paidAmt'));
    setCurrency(row.getCell('pending'));
    
    shopRow++;
  }

  const sTotalRow = wsShops.addRow({ shopNo: 'TOTAL' });
  sTotalRow.font = { bold: true };
  if (shopRow > 2) {
    sTotalRow.getCell('price').value = { formula: `SUM(H2:H${shopRow-1})` };
    sTotalRow.getCell('saleAmt').value = { formula: `SUM(I2:I${shopRow-1})` };
    sTotalRow.getCell('paidAmt').value = { formula: `SUM(J2:J${shopRow-1})` };
    sTotalRow.getCell('pending').value = { formula: `SUM(K2:K${shopRow-1})` };
  }
  setCurrency(sTotalRow.getCell('price'));
  setCurrency(sTotalRow.getCell('saleAmt'));
  setCurrency(sTotalRow.getCell('paidAmt'));
  setCurrency(sTotalRow.getCell('pending'));


  // ----- 3. Tenants Directory -----
  const wsTenants = workbook.addWorksheet('3. Tenants Profiles');
  styleHeader(wsTenants, [
    { label: 'Tenant Name', key: 'name', width: 25 },
    { label: 'CNIC', key: 'cnic', width: 20 },
    { label: 'Mobile No.', key: 'mobile', width: 18 },
    { label: 'Email Address', key: 'email', width: 30 },
    { label: 'Residential Address', key: 'address', width: 40 },
    { label: 'Emergency Contact', key: 'emergency', width: 20 },
    { label: 'Owned Shops', key: 'shops', width: 30 },
  ], 'FF059669'); // Green

  for (const t of (tenants||[])) {
    const tSales = (sales||[]).filter(s => s.tenantId === t.id);
    const tShops = tSales.map(s => {
      const shop = (shops||[]).find(sh => sh.id === s.shopId);
      return shop ? `${shop.shopNumber} (${shop.block})` : '';
    }).filter(Boolean).join(', ');

    wsTenants.addRow({
      name: t.name,
      cnic: t.cnic,
      mobile: t.mobile,
      email: t.email,
      address: t.address,
      emergency: t.emergencyContact,
      shops: tShops || 'None'
    });
  }


  // ----- 4. Payment History (Ledger) -----
  const wsPayments = workbook.addWorksheet('4. Payment History');
  styleHeader(wsPayments, [
    { label: 'Date', key: 'date', width: 15 },
    { label: 'Receipt No.', key: 'receipt', width: 15 },
    { label: 'Tenant Name', key: 'tenant', width: 25 },
    { label: 'Tenant CNIC', key: 'cnic', width: 20 },
    { label: 'Associated Shops', key: 'shops', width: 30 },
    { label: 'Amount Paid', key: 'amount', width: 20 },
  ], 'FFD97706'); // Amber

  let paymentRow = 2;
  const sortedPayments = [...(payments||[])].sort((a,b) => new Date(a.date) - new Date(b.date));
  for (const p of sortedPayments) {
    const tenantId = p.tenantId || ((sales||[]).find(s => s.id === p.saleId)?.tenantId);
    const tenant = (tenants||[]).find(t => t.id === tenantId);
    
    let tShops = '';
    if (tenant) {
      const tSales = (sales||[]).filter(s => s.tenantId === tenant.id);
      tShops = tSales.map(s => {
        const shop = (shops||[]).find(sh => sh.id === s.shopId);
        return shop ? shop.shopNumber : '';
      }).filter(Boolean).join(', ');
    }
    
    const row = wsPayments.addRow({
      date: new Date(p.date).toLocaleDateString(),
      receipt: p.receiptNo || 'N/A',
      tenant: tenant ? tenant.name : 'Unknown',
      cnic: tenant ? tenant.cnic : 'N/A',
      shops: tShops,
      amount: parseFloat(p.amount || 0)
    });
    setCurrency(row.getCell('amount'));
    paymentRow++;
  }

  const pTotalRow = wsPayments.addRow({ shops: 'TOTAL PAYMENTS RECEIVED' });
  pTotalRow.font = { bold: true };
  if (paymentRow > 2) {
    pTotalRow.getCell('amount').value = { formula: `SUM(F2:F${paymentRow-1})` };
  }
  setCurrency(pTotalRow.getCell('amount'));


  // ----- 5. Contractors & Construction -----
  const wsContractors = workbook.addWorksheet('5. Contractors Overview');
  styleHeader(wsContractors, [
    { label: 'Contractor Name', key: 'name', width: 25 },
    { label: 'Trade / Specialty', key: 'trade', width: 25 },
    { label: 'Phone', key: 'phone', width: 18 },
    { label: 'Total Budget (Max)', key: 'budget', width: 20 },
    { label: 'Total Paid', key: 'paid', width: 20 },
    { label: 'Balance Due', key: 'balance', width: 20 },
  ], 'FF7C3AED'); // Purple

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
    
    setCurrency(row.getCell('budget'));
    setCurrency(row.getCell('paid'));
    setCurrency(row.getCell('balance'));
    
    cRow++;
  }

  const cTotalRow = wsContractors.addRow({ phone: 'TOTAL CONTRACTOR BUDGETS' });
  cTotalRow.font = { bold: true };
  if (cRow > 2) {
    cTotalRow.getCell('budget').value = { formula: `SUM(D2:D${cRow-1})` };
    cTotalRow.getCell('paid').value = { formula: `SUM(E2:E${cRow-1})` };
    cTotalRow.getCell('balance').value = { formula: `SUM(F2:F${cRow-1})` };
  }
  setCurrency(cTotalRow.getCell('budget'));
  setCurrency(cTotalRow.getCell('paid'));
  setCurrency(cTotalRow.getCell('balance'));


  // ----- 6. Contractor Payments -----
  const wsCPayments = workbook.addWorksheet('6. Contractor Payments');
  styleHeader(wsCPayments, [
    { label: 'Payment Date', key: 'date', width: 18 },
    { label: 'Contractor Name', key: 'name', width: 25 },
    { label: 'Trade', key: 'trade', width: 20 },
    { label: 'Amount Paid', key: 'amount', width: 20 },
    { label: 'Notes', key: 'notes', width: 40 },
  ], 'FF9333EA'); // Lighter purple
  
  let cpRow = 2;
  const sortedCPayments = [...(contractorPayments||[])].sort((a,b) => new Date(a.payment_date) - new Date(b.payment_date));
  for (const cp of sortedCPayments) {
    const contractor = (contractors||[]).find(c => c.id === cp.contractor_id);
    const row = wsCPayments.addRow({
      date: new Date(cp.payment_date).toLocaleDateString(),
      name: contractor ? contractor.name : 'Unknown',
      trade: contractor ? contractor.trade : 'Unknown',
      amount: parseFloat(cp.amount_paid || 0),
      notes: cp.notes || ''
    });
    setCurrency(row.getCell('amount'));
    cpRow++;
  }
  
  const cpTotalRow = wsCPayments.addRow({ trade: 'TOTAL OUTGOING' });
  cpTotalRow.font = { bold: true };
  if (cpRow > 2) {
    cpTotalRow.getCell('amount').value = { formula: `SUM(D2:D${cpRow-1})` };
  }
  setCurrency(cpTotalRow.getCell('amount'));

  // ----- Finalize & Download -----
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const cleanProjectName = (projectName || 'Project').replace(/[^a-z0-9]/gi, '_');
  saveAs(blob, `${cleanProjectName}_Master_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}
