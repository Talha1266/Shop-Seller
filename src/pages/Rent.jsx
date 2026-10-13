import { useState, useMemo, useRef, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { Plus, X, Search, DollarSign, Printer, Trash2, Paperclip, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useProject } from '../contexts/ProjectContext';
import { supabase } from '../supabaseClient';
const RentReceiptPrint = ({ printData, innerRef, projectName, appSettings }) => {
  const [signatureUrl, setSignatureUrl] = useState('');
  const [watermarkUrl, setWatermarkUrl] = useState('');

  useEffect(() => {
    if (appSettings?.auth_signature_url) {
      supabase.storage
        .from('tenant-documents')
        .createSignedUrl(appSettings.auth_signature_url, 3600)
        .then(({ data }) => {
          if (data) setSignatureUrl(data.signedUrl);
        });
    }
    if (appSettings?.watermark_url) {
      supabase.storage
        .from('tenant-documents')
        .createSignedUrl(appSettings.watermark_url, 3600)
        .then(({ data }) => {
          if (data) setWatermarkUrl(data.signedUrl);
        });
    }
  }, [appSettings?.auth_signature_url, appSettings?.watermark_url]);

  if (!printData) return <div ref={innerRef}></div>;

  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none', position: 'relative' }} className="print-receipt-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          .print-receipt-wrapper { display: block !important; }
        `}
      </style>
      <div style={{ border: '2px solid #000', padding: '30px', maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1, backgroundColor: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          {watermarkUrl && (
            <img 
              src={watermarkUrl} 
              alt="Logo" 
              style={{ maxHeight: '140px', maxWidth: '160px', objectFit: 'contain', mixBlendMode: 'multiply', marginRight: '20px' }} 
            />
          )}
          
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ margin: '0 0 10px 0', textTransform: 'uppercase', lineHeight: '1.3' }}>
              {projectName ? (
                projectName.toUpperCase().includes(' CHAK') 
                  ? <>
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{projectName.split(/(?=\bCHAK\b)/i)[0]}</span><br/>
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{projectName.split(/(?=\bCHAK\b)/i)[1]}</span>
                    </>
                  : <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{projectName}</span>
              ) : <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Plaza Management</span>}
            </div>
            <h2 style={{ margin: 0, color: '#555', fontSize: '18px' }}>Rent Receipt</h2>
          </div>
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

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '250px', textAlign: 'center' }}>
            {signatureUrl && (
              <img 
                src={signatureUrl} 
                alt="Signature" 
                style={{ maxHeight: '60px', marginBottom: '5px', objectFit: 'contain', mixBlendMode: 'multiply', filter: 'grayscale(100%) contrast(300%) brightness(150%)' }} 
              />
            )}
            <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{appSettings?.auth_name || 'Authorized Signature'}</p>
              {appSettings?.auth_department && <p style={{ margin: '2px 0', fontSize: '12px' }}>{appSettings.auth_department}</p>}
              {appSettings?.auth_branch && <p style={{ margin: '2px 0', fontSize: '12px' }}>{appSettings.auth_branch}</p>}
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '40px', textAlign: 'center', color: '#000', fontSize: '18px', fontWeight: 'bold' }}>
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
  const [sortConfig, setSortConfig] = useState({ key: 'shop', direction: 'asc' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState(null);
  const [viewingAttachmentTitle, setViewingAttachmentTitle] = useState('');

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.75rem' }}>⇅</span>;
    return <span style={{ marginLeft: '4px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  const getAttachmentPath = (payment) => {
    if (!payment) return null;
    if (payment.attachment_url) return payment.attachment_url;
    if (payment.notes && payment.notes.includes('[Attachment: ')) {
      const match = payment.notes.match(/\[Attachment:\s*([^\]]+)\]/);
      if (match) return match[1].trim();
    }
    return null;
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit. Please choose a smaller image.');
        e.target.value = '';
        return;
      }
      setAttachmentFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreview(null);
      }
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
  };

  const handleOpenAttachmentViewer = async (payment) => {
    const path = getAttachmentPath(payment);
    if (!path) return;

    try {
      const { data, error } = await supabase.storage
        .from('tenant-documents')
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) {
        const { data: pubData } = supabase.storage
          .from('tenant-documents')
          .getPublicUrl(path);
        setViewingAttachmentUrl(pubData?.publicUrl || path);
      } else {
        setViewingAttachmentUrl(data.signedUrl);
      }
      setViewingAttachmentTitle(`Attachment - Receipt #${payment.receipt_no} (${payment.payment_method || 'Cheque/Online'})`);
    } catch (err) {
      console.error(err);
      alert('Failed to load attachment: ' + err.message);
    }
  };
  
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
  const appSettingsList = useSupabase('app_settings') || [];
  const appSettings = appSettingsList.length > 0 ? appSettingsList[0] : null;

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
    const latestSalesMap = new Map();
    sales.forEach(s => {
      const existing = latestSalesMap.get(s.shopId);
      if (!existing || new Date(s.date || 0) > new Date(existing.date || 0)) {
        latestSalesMap.set(s.shopId, s);
      }
    });
    const uniqueSales = Array.from(latestSalesMap.values());

    let filtered = uniqueSales.filter(s => {
      const shop = shops.find(sh => sh.id === s.shopId);
      if (shop?.status !== 'Occupied') return false;
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

    const mapped = filtered.map(sale => {
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

    const floorOrder = (name = '') => {
      const n = (name || '').toLowerCase().trim();
      if (n.includes('base') || n.includes('b.f') || n === 'b1') return -1;
      if (n.includes('ground') || n.includes('g.f') || n === 'gf' || n === 'g') return 0;
      if (n.includes('first') || n.includes('1st') || n.includes('f.f') || n === 'ff' || n === '1f') return 1;
      if (n.includes('second') || n.includes('2nd') || n.includes('s.f') || n === 'sf' || n === '2f') return 2;
      if (n.includes('third') || n.includes('3rd') || n.includes('t.f') || n === 'tf' || n === '3f') return 3;
      if (n.includes('fourth') || n.includes('4th') || n.includes('4f')) return 4;
      const num = parseInt(n, 10);
      return isNaN(num) ? 99 : num + 10;
    };

    const extractShopNum = (val) => {
      const match = String(val || '').match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    return mapped.sort((a, b) => {
      let comparison = 0;
      if (sortConfig.key === 'tenant') {
        const tenantA = getTenantDetails(a.tenantId).toLowerCase();
        const tenantB = getTenantDetails(b.tenantId).toLowerCase();
        comparison = tenantA.localeCompare(tenantB);
      } else if (sortConfig.key === 'rentDue') {
        comparison = a.rentDue - b.rentDue;
      } else if (sortConfig.key === 'amountPaid') {
        comparison = a.amountPaid - b.amountPaid;
      } else if (sortConfig.key === 'balance') {
        comparison = a.balance - b.balance;
      } else if (sortConfig.key === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else {
        // Default: Sort by shop details in ascending order (Block -> Floor -> Shop Number)
        const shopA = shops.find(sh => sh.id === a.shopId);
        const shopB = shops.find(sh => sh.id === b.shopId);

        // 1. Block: alphabetical ascending (A, B, C...)
        const blockCmp = (shopA?.block || '').localeCompare(shopB?.block || '', undefined, { numeric: true, sensitivity: 'base' });
        if (blockCmp !== 0) {
          comparison = blockCmp;
        } else {
          // 2. Floor: Ground -> 1st -> 2nd...
          const floorCmp = floorOrder(shopA?.floor) - floorOrder(shopB?.floor);
          if (floorCmp !== 0) {
            comparison = floorCmp;
          } else {
            // 3. Shop Number: numeric ascending (1, 2, 3... 10...)
            const numA = extractShopNum(shopA?.shopNumber);
            const numB = extractShopNum(shopB?.shopNumber);
            if (numA !== numB) {
              comparison = numA - numB;
            } else {
              comparison = String(shopA?.shopNumber || '').localeCompare(String(shopB?.shopNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
            }
          }
        }
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [sales, shops, tenants, rentCollections, selectedMonthString, searchQuery, sortConfig]);

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
    let uploadedPath = null;
    if (attachmentFile) {
      setIsUploadingAttachment(true);
      const fileExt = attachmentFile.name.split('.').pop();
      const cleanFileName = `cheque_${selectedSale.id}_${Date.now()}.${fileExt}`;
      const filePath = `rent/cheques/${cleanFileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(filePath, attachmentFile, { upsert: true });

        if (!uploadError) {
          uploadedPath = filePath;
        } else {
          console.warn('Storage upload error, continuing:', uploadError);
        }
      } catch (uploadErr) {
        console.warn('Failed to upload file to storage:', uploadErr);
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    if (uploadedPath) {
      notes = `[Attachment: ${uploadedPath}] ` + notes;
    }

    const newPayment = {
      sale_id: selectedSale.id,
      month: selectedMonthString,
      amount_paid: amount > selectedSale.balance && currentFine > 0 ? selectedSale.balance : amount, // allocate to base rent first
      fine_amount: amount > selectedSale.balance && currentFine > 0 ? amount - selectedSale.balance : 0,
      date: formData.get('date'),
      receipt_no: receiptNo,
      payment_method: paymentMethod,
      attachment_url: uploadedPath,
      notes: notes
    };

    try {
      try {
        await db.rent_collections.add(newPayment);
      } catch (insertErr) {
        if (insertErr.message && (insertErr.message.includes('payment_method') || insertErr.message.includes('attachment_url') || insertErr.code === '42703')) {
          const fallbackPayment = {
            sale_id: selectedSale.id,
            month: selectedMonthString,
            amount_paid: amount > selectedSale.balance && currentFine > 0 ? selectedSale.balance : amount,
            fine_amount: amount > selectedSale.balance && currentFine > 0 ? amount - selectedSale.balance : 0,
            date: formData.get('date'),
            receipt_no: receiptNo,
            notes: `[Method: ${paymentMethod}] ` + notes
          };
          await db.rent_collections.add(fallbackPayment);
        } else {
          throw insertErr;
        }
      }
      
      triggerPrint({
        receipt_no: receiptNo,
        date: formData.get('date'),
        tenantName: getTenantDetails(selectedSale.tenantId),
        shopDetails: getShopDetails(selectedSale.shopId),
        month: selectedMonthString,
        rentAmount: selectedSale.balance,
        fineAmount: currentFine,
        amount_paid: amount,
        payment_method: paymentMethod
      });

      setAttachmentFile(null);
      setAttachmentPreview(null);
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
        appSettings={appSettings}
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
                <th onClick={() => requestSort('shop')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Shop Details">
                  Shop Details {getSortIndicator('shop')}
                </th>
                <th onClick={() => requestSort('tenant')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Tenant">
                  Tenant {getSortIndicator('tenant')}
                </th>
                <th onClick={() => requestSort('rentDue')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Rent Due">
                  Rent Due {getSortIndicator('rentDue')}
                </th>
                <th onClick={() => requestSort('amountPaid')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Amount Paid">
                  Amount Paid {getSortIndicator('amountPaid')}
                </th>
                <th onClick={() => requestSort('balance')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Balance">
                  Balance {getSortIndicator('balance')}
                </th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by Status">
                  Status {getSortIndicator('status')}
                </th>
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
                  <label className="form-label">Payment Method</label>
                  <select 
                    className="form-control" 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online Deposit">Online Deposit</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                {paymentMethod !== 'Cash' && (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '0.85rem', 
                    borderRadius: '8px', 
                    border: '1px dashed var(--color-primary)', 
                    backgroundColor: 'rgba(59, 130, 246, 0.04)' 
                  }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Paperclip size={16} color="var(--color-primary)" />
                        {paymentMethod === 'Cheque' ? 'Attach Picture of Cheque (Optional)' : 'Attach Picture of Receipt / Slip (Optional)'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>JPG, PNG up to 10MB</span>
                    </label>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="form-control" 
                      onChange={handleAttachmentChange}
                      style={{ fontSize: '0.85rem' }} 
                    />
                    {attachmentPreview && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img 
                          src={attachmentPreview} 
                          alt="Cheque Preview" 
                          style={{ maxHeight: '75px', maxWidth: '130px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }} 
                        />
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {attachmentFile?.name}
                          </span>
                          <button 
                            type="button" 
                            onClick={handleRemoveAttachment}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                          >
                            Remove picture
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <input type="text" name="notes" className="form-control" placeholder="e.g. Paid in cash, Check #1234" />
                </div>
                
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setSelectedSale(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isUploadingAttachment}>
                    {isUploadingAttachment ? 'Uploading Photo...' : 'Save Payment & Print'}
                  </button>
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
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {getAttachmentPath(pmt) && (
                                <button 
                                  className="icon-btn" 
                                  style={{ color: 'var(--color-primary)' }}
                                  title="View Attached Cheque / Receipt Photo"
                                  onClick={() => handleOpenAttachmentViewer(pmt)}
                                >
                                  <Paperclip size={16} />
                                </button>
                              )}
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
                                  amount_paid: totalAmt,
                                  payment_method: pmt.payment_method
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

      {/* Attachment Viewer Modal */}
      {viewingAttachmentUrl && (
        <div className="modal-overlay" onClick={() => setViewingAttachmentUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Paperclip size={18} /> {viewingAttachmentTitle || 'Payment Attachment'}
              </h2>
              <button className="icon-btn" onClick={() => setViewingAttachmentUrl(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={viewingAttachmentUrl} 
                alt="Cheque / Receipt" 
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <a 
                href={viewingAttachmentUrl} 
                target="_blank" 
                rel="noreferrer" 
                download
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={14} /> Open Full Size / Download
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setViewingAttachmentUrl(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
