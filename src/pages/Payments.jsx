import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X, Printer, Edit, Lock, LockOpen, Search, Paperclip, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useProject } from '../contexts/ProjectContext';

// Helper to extract cheque details from payment
export const getChequeDetails = (payment) => {
  if (!payment) return { chequeNo: '', chequeDate: '' };
  let chqNo = payment.cheque_no || payment.chequeNo || '';
  let chqDate = payment.cheque_date || payment.chequeDate || '';
  if (!chqNo && payment.notes) {
    const m = payment.notes.match(/Cheque\s*(?:#|No|Number)?:\s*([^,\]]+)/i);
    if (m) chqNo = m[1].trim();
  }
  if (!chqDate && payment.notes) {
    const m = payment.notes.match(/Cheque\s*Date:\s*([^,\]]+)/i) || payment.notes.match(/(?:Date):\s*([^,\]]+)/i);
    if (m) chqDate = m[1].trim();
  }
  return { chequeNo: chqNo, chequeDate: chqDate };
};

// Receipt component for printing
const ReceiptPrint = ({ payment, tenantShops, tenant, innerRef, projectName }) => {
  if (!payment) return <div ref={innerRef}></div>;
  const chqInfo = getChequeDetails(payment);
  const pmtMode = payment.payment_method || (payment.isAdvance ? 'Advance' : 'Cash');
  
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
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>{projectName || 'Plaza Management'}</h1>
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
          <p style={{ margin: '5px 0' }}><strong>Payment Mode:</strong> {pmtMode}</p>
          {(payment.payment_method === 'Cheque' || chqInfo.chequeNo) && (
            <>
              {chqInfo.chequeNo && <p style={{ margin: '5px 0' }}><strong>Cheque Number:</strong> {chqInfo.chequeNo}</p>}
              {chqInfo.chequeDate && <p style={{ margin: '5px 0' }}><strong>Cheque Date:</strong> {chqInfo.chequeDate}</p>}
            </>
          )}
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

const AllPaymentsReportPrint = ({
  paymentsList,
  innerRef,
  projectName,
  appSettings,
  searchQuery,
  getPaymentDetails,
}) => {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (appSettings?.watermark_url) {
      supabase.storage
        .from('tenant-documents')
        .createSignedUrl(appSettings.watermark_url, 3600)
        .then(({ data }) => {
          if (data) setLogoUrl(data.signedUrl);
        });
    }
  }, [appSettings?.watermark_url]);

  if (!paymentsList) return <div ref={innerRef}></div>;

  const totalAmount = paymentsList.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={innerRef} className="print-all-payments-wrapper" style={{ display: 'none', padding: '24px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; }
          .print-all-payments-wrapper { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxHeight: '70px', maxWidth: '100px', objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {projectName || 'Plaza Management'}
            </h1>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 600, color: '#334155', letterSpacing: '0.25px' }}>
              ALL SHOPS PAYMENT & INSTALLMENTS COLLECTION REPORT
            </h2>
            {searchQuery && (
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                Filtered by: "{searchQuery}"
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Generated:</strong> {formattedDate} {formattedTime}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Transactions:</strong> {paymentsList.length}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Collected:</strong> Rs. {totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: 1.4 }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f172a' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>#</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '130px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Receipt No.</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '95px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Date</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Shop Details</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Tenant Name</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Payment Mode</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '140px', fontWeight: 700 }}>Amount Paid</th>
          </tr>
        </thead>
        <tbody>
          {paymentsList.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                No payment records found.
              </td>
            </tr>
          ) : (
            paymentsList.map((payment, idx) => {
              const details = getPaymentDetails(payment);
              const shopText = details?.tenantShops && details.tenantShops.length > 0
                ? details.tenantShops.map(s => `Shop ${s.shopNumber} (${s.block}, ${s.floor})`).join(', ')
                : 'N/A';
              const pmtDate = payment.date ? new Date(payment.date).toLocaleDateString('en-GB') : '—';
              const pmtMethod = payment.payment_method || (payment.isAdvance ? 'Advance' : 'Cash');

              return (
                <tr
                  key={payment.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                    {payment.receiptNo}
                    {payment.isAdvance && (
                      <span style={{ display: 'block', fontSize: '9px', color: '#4f46e5', fontWeight: 700 }}>
                        [Registration]
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    {pmtDate}
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, borderRight: '1px solid #e2e8f0' }}>
                    {shopText}
                  </td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>
                    <strong>{details?.tenant?.name || 'N/A'}</strong>
                    {details?.tenant?.mobile && (
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                        {details.tenant.mobile}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 600 }}>{pmtMethod}</span>
                    {(() => {
                      const chq = getChequeDetails(payment);
                      if (!chq.chequeNo) return null;
                      return (
                        <span style={{ display: 'block', fontSize: '9px', color: '#1e40af', marginTop: '2px', fontWeight: 500 }}>
                          #{chq.chequeNo} {chq.chequeDate ? `(${chq.chequeDate})` : ''}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>
                    Rs. {Number(payment.amount || 0).toLocaleString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {paymentsList.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700 }}>
              <td colSpan="6" style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                TOTAL AMOUNT COLLECTED ({paymentsList.length} {paymentsList.length === 1 ? 'TRANSACTION' : 'TRANSACTIONS'})
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#0f766e', fontSize: '12px' }}>
                Rs. {totalAmount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Signature Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', pageBreakInside: 'avoid', fontSize: '11px', color: '#334155' }}>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontWeight: 600 }}>Prepared By</div>
        </div>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontWeight: 600 }}>Checked / Verified By</div>
        </div>
        <div style={{ textAlign: 'center', width: '220px' }}>
          <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontWeight: 600 }}>Authorized Signature & Stamp</div>
        </div>
      </div>
    </div>
  );
};

export default function Payments({ currentUser }) {
  const db = useDb();
  const { activeProject } = useProject();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState(null);
  const [printPaymentId, setPrintPaymentId] = useState(null);
  const [preSelectedTenantId, setPreSelectedTenantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState(null);
  const [viewingAttachmentTitle, setViewingAttachmentTitle] = useState('');
  const location = useLocation();

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
      setViewingAttachmentTitle(`Attachment - Receipt #${payment.receiptNo} (${payment.payment_method || 'Cheque/Online'})`);
    } catch (err) {
      console.error(err);
      alert('Failed to load attachment: ' + err.message);
    }
  };

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
  const printAllPaymentsRef = useRef(null);

  const payments = useSupabase('payments') || [];
  const sales = useSupabase('sales') || [];
  const shops = useSupabase('shops') || [];
  const tenants = useSupabase('tenants') || [];
  const appSettingsList = useSupabase('app_settings') || [];
  const appSettings = appSettingsList.length > 0 ? appSettingsList[0] : null;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintAllPayments = useReactToPrint({
    contentRef: printAllPaymentsRef,
    documentTitle: `${activeProject?.name || 'Plaza'}_All_Shops_Payment_Report`,
  });

  const triggerPrint = (paymentId) => {
    setPrintPaymentId(paymentId);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const generateReceiptNo = () => {
    return 'REC-' + Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tenantId = formData.get('tenantId');

    if (paymentMethod === 'Cheque') {
      if (!chequeNo || !chequeNo.trim()) {
        alert('Cheque Number is compulsory for Cheque payments.');
        return;
      }
      if (!chequeDate) {
        alert('Cheque Date is compulsory for Cheque payments.');
        return;
      }
    }

    let uploadedPath = null;
    if (attachmentFile) {
      setIsUploadingAttachment(true);
      const fileExt = attachmentFile.name.split('.').pop();
      const cleanFileName = `cheque_${tenantId}_${Date.now()}.${fileExt}`;
      const filePath = `installments/cheques/${cleanFileName}`;

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

    const chequeNotes = paymentMethod === 'Cheque' ? `[Cheque #: ${chequeNo.trim()}, Date: ${chequeDate}]` : '';
    const fullNotes = [chequeNotes, uploadedPath ? `[Attachment: ${uploadedPath}]` : ''].filter(Boolean).join(' ');

    const newPayment = {
      tenantId: tenantId,
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount')),
      receiptNo: formData.get('receiptNo') || generateReceiptNo(),
      payment_method: paymentMethod,
      cheque_no: paymentMethod === 'Cheque' ? chequeNo.trim() : null,
      cheque_date: paymentMethod === 'Cheque' ? chequeDate : null,
      attachment_url: uploadedPath,
      notes: fullNotes
    };
    
    try {
      await db.payments.add(newPayment);
    } catch (insertErr) {
      if (insertErr.message && (
        insertErr.message.includes('payment_method') || 
        insertErr.message.includes('cheque_no') || 
        insertErr.message.includes('cheque_date') || 
        insertErr.message.includes('attachment_url') || 
        insertErr.code === '42703'
      )) {
        const fallbackPayment = {
          tenantId: tenantId,
          date: formData.get('date'),
          amount: parseFloat(formData.get('amount')),
          receiptNo: formData.get('receiptNo') || generateReceiptNo(),
          notes: `[Method: ${paymentMethod}] ${fullNotes}`.trim()
        };
        await db.payments.add(fallbackPayment);
      } else {
        throw insertErr;
      }
    }

    setAttachmentFile(null);
    setAttachmentPreview(null);
    setChequeNo('');
    setChequeDate('');
    setPaymentMethod('Cash');
    setIsModalOpen(false);
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

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [filteredPayments]);

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
        projectName={activeProject?.name}
      />

      <AllPaymentsReportPrint
        paymentsList={sortedPayments}
        innerRef={printAllPaymentsRef}
        projectName={activeProject?.name}
        appSettings={appSettings}
        searchQuery={searchQuery}
        getPaymentDetails={getPaymentDetails}
      />

      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Installment Payments</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search tenant or receipt..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '35px', minWidth: '220px' }}
            />
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrintAllPayments}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
            title="Print All Shops Payment & Collection Report"
          >
            <Printer size={18} /> Print Payments Report
          </button>
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
              {sortedPayments.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No payments recorded yet.</td></tr>
              ) : (
                sortedPayments.map(payment => {
                  const details = getPaymentDetails(payment);
                  return (
                    <tr key={payment.id}>
                      <td style={{ fontWeight: 500 }}>
                        {payment.receiptNo}
                        {payment.isAdvance && <span style={{ marginLeft: '8px', fontSize: '0.65rem', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '12px' }}>Registration</span>}
                        {(() => {
                          const chq = getChequeDetails(payment);
                          if (payment.payment_method === 'Cheque' || chq.chequeNo) {
                            return (
                              <span style={{ marginLeft: '6px', fontSize: '0.7rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Cheque {chq.chequeNo ? `#${chq.chequeNo}` : ''}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td>{new Date(payment.date).toLocaleDateString()}</td>
                      <td>{details?.tenant?.name || 'N/A'}</td>
                      <td>{details?.tenantShops ? details.tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block})`).join(', ') : 'N/A'}</td>
                      <td style={{ fontWeight: 600 }}>Rs. {payment.amount.toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {getAttachmentPath(payment) && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', color: 'var(--color-primary)' }} 
                            title="View Attached Cheque / Receipt Photo"
                            onClick={() => handleOpenAttachmentViewer(payment)}
                          >
                            <Paperclip size={16} /> Cheque
                          </button>
                        )}
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
                <label className="form-label">Receipt Number (System Generated)</label>
                <input type="text" name="receiptNo" className="form-control" defaultValue={generateReceiptNo()} readOnly style={{ backgroundColor: 'var(--color-bg-app)', cursor: 'not-allowed', color: 'var(--color-text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
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

              {paymentMethod === 'Cheque' && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '0.75rem', 
                  marginBottom: '1rem', 
                  padding: '0.85rem', 
                  backgroundColor: '#eff6ff', 
                  borderRadius: '8px', 
                  border: '1px solid #bfdbfe' 
                }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Cheque Number <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      name="cheque_no" 
                      className="form-control" 
                      required 
                      value={chequeNo} 
                      onChange={e => setChequeNo(e.target.value)} 
                      placeholder="e.g. CHQ-987654" 
                      style={{ borderColor: '#93c5fd', backgroundColor: '#ffffff' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Cheque Date <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input 
                      type="date" 
                      name="cheque_date" 
                      className="form-control" 
                      required 
                      value={chequeDate} 
                      onChange={e => setChequeDate(e.target.value)} 
                      style={{ borderColor: '#93c5fd', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

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
                <label className="form-label">Amount Received</label>
                <input type="number" name="amount" className="form-control" required min="1" step="0.01" />
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={activeSales.length === 0 || isUploadingAttachment}>
                  {isUploadingAttachment ? 'Uploading Photo...' : 'Save Payment'}
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

      {/* Attachment Viewer Modal */}
      {viewingAttachmentUrl && (
        <div className="modal-overlay" onClick={() => setViewingAttachmentUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Paperclip size={18} /> {viewingAttachmentTitle || 'Payment Attachment'}
              </h2>
              <button className="modal-close" onClick={() => setViewingAttachmentUrl(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
              <img src={viewingAttachmentUrl} alt="Cheque / Receipt" style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <a href={viewingAttachmentUrl} target="_blank" rel="noreferrer" download className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Download size={14} /> Open Full Size / Download
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setViewingAttachmentUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
