import { useState, useMemo, useRef, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { Plus, X, Search, DollarSign, Printer, Trash2, Paperclip, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useProject } from '../contexts/ProjectContext';
import { supabase } from '../supabaseClient';
export const getChequeDetailsFromRent = (payment) => {
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

  const chqInfo = {
    chequeNo: printData.cheque_no || getChequeDetailsFromRent(printData).chequeNo,
    chequeDate: printData.cheque_date || getChequeDetailsFromRent(printData).chequeDate
  };

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
          {printData.payment_method && (
            <p style={{ margin: '5px 0' }}><strong>Payment Mode:</strong> {printData.payment_method}</p>
          )}
          {(printData.payment_method === 'Cheque' || chqInfo.chequeNo) && (
            <>
              {chqInfo.chequeNo && <p style={{ margin: '5px 0' }}><strong>Cheque Number:</strong> {chqInfo.chequeNo}</p>}
              {chqInfo.chequeDate && <p style={{ margin: '5px 0' }}><strong>Cheque Date:</strong> {chqInfo.chequeDate}</p>}
            </>
          )}
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
            {printData.fineWaived && (
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', color: '#16a34a' }}>Late Fine (Waived / معافی)</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>Rs. 0 (Waived)</td>
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

const RentReportPrint = ({
  sales,
  shops,
  tenants,
  monthFormatted,
  innerRef,
  projectName,
  appSettings,
  searchQuery,
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

  if (!sales) return <div ref={innerRef}></div>;

  const totalRentDue = sales.reduce((sum, s) => sum + (s.rentDue || 0), 0);
  const totalPaid = sales.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const totalBalance = sales.reduce((sum, s) => sum + (s.balance || 0), 0);

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getShopDetails = (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    return shop ? `Shop ${shop.shopNumber} (${shop.block}, ${shop.floor})` : 'Unknown Shop';
  };

  const getTenantDetails = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : 'Unknown Tenant';
  };

  return (
    <div ref={innerRef} className="print-rent-report-wrapper" style={{ display: 'none', padding: '24px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; }
          .print-rent-report-wrapper { display: block !important; }
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
              RENT & MAINTENANCE COLLECTION REPORT — {monthFormatted}
            </h2>
            {searchQuery && (
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                Filtered by: "{searchQuery}"
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Billing Month:</strong> {monthFormatted}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Printed On:</strong> {formattedDate} {formattedTime}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Units:</strong> {sales.length}</p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: 1.4 }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f172a' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>#</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Shop Details</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Tenant Name</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '130px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Monthly Rent Due</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '130px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Amount Paid</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '130px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Balance Due</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '100px', fontWeight: 700 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                No rent records found for this month.
              </td>
            </tr>
          ) : (
            sales.map((sale, idx) => (
              <tr
                key={sale.id}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                  {getShopDetails(sale.shopId)}
                </td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>
                  {getTenantDetails(sale.tenantId)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                  Rs. {Number(sale.rentDue || 0).toLocaleString()}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #e2e8f0', color: sale.amountPaid > 0 ? '#0f766e' : 'inherit', fontWeight: 500 }}>
                  {sale.amountPaid > 0 ? `Rs. ${Number(sale.amountPaid).toLocaleString()}` : '—'}
                </td>
                <td style={{
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontWeight: 700,
                  borderRight: '1px solid #e2e8f0',
                  color: sale.balance > 0 ? '#b91c1c' : '#15803d',
                }}>
                  Rs. {Number(sale.balance || 0).toLocaleString()}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: sale.status === 'Paid' ? '#dcfce7' : sale.status === 'Partial' ? '#fef3c7' : '#fee2e2',
                    color: sale.status === 'Paid' ? '#15803d' : sale.status === 'Partial' ? '#b45309' : '#b91c1c',
                    border: `1px solid ${sale.status === 'Paid' ? '#bbf7d0' : sale.status === 'Partial' ? '#fde68a' : '#fecaca'}`,
                  }}>
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {sales.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700 }}>
              <td colSpan="3" style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                TOTALS ({sales.length} {sales.length === 1 ? 'UNIT' : 'UNITS'})
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                Rs. {totalRentDue.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>
                Rs. {totalPaid.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: totalBalance > 0 ? '#b91c1c' : '#15803d' }}>
                Rs. {totalBalance.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                {totalBalance <= 0 ? 'CLEARED' : `${Math.round((totalPaid / (totalRentDue || 1)) * 100)}% PAID`}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Signature Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', paddingTop: '20px', pageBreakInside: 'avoid', fontSize: '11px', color: '#334155' }}>
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
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState(null);
  const [viewingAttachmentTitle, setViewingAttachmentTitle] = useState('');
  const [isFineWaived, setIsFineWaived] = useState(false);
  const [customFine, setCustomFine] = useState(null);

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
  const printRentReportRef = useRef(null);
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

  const handlePrintRentReport = useReactToPrint({
    contentRef: printRentReportRef,
    documentTitle: `${activeProject?.name || 'Plaza'}_Rent_Report_${selectedMonthString}`,
  });

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

    const calculatedFine = calculateFine(selectedMonthString, paymentDate);
    const currentFine = isFineWaived ? 0 : (customFine !== null ? customFine : calculatedFine);
    const receiptNo = formData.get('receipt_no') || generateReceiptNo();

    // Notes can include fine info or fine waiver (maafi) info
    let notes = formData.get('notes') || '';
    if (isFineWaived || (calculatedFine > 0 && currentFine === 0)) {
      notes = `[Late Fine of Rs. ${calculatedFine.toLocaleString()} Waived (Fine Maafi) by Admin] ` + notes;
    } else if (calculatedFine > 0 && currentFine < calculatedFine) {
      notes = `[Fine Partial Maafi: Reduced from Rs. ${calculatedFine.toLocaleString()} to Rs. ${currentFine.toLocaleString()}] ` + notes;
    } else if (currentFine > 0) {
      notes = `Includes Rs. ${currentFine.toLocaleString()} late fine. ` + notes;
    }

    const chequeInfo = paymentMethod === 'Cheque' ? `[Cheque #: ${chequeNo.trim()}, Date: ${chequeDate}]` : '';
    if (chequeInfo) {
      notes = `${chequeInfo} ${notes}`.trim();
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

    const baseAmountPaid = currentFine > 0
      ? (amount > selectedSale.balance ? selectedSale.balance : amount)
      : amount;
    const fineAmountPaid = currentFine > 0
      ? (amount > selectedSale.balance ? amount - selectedSale.balance : 0)
      : 0;

    const newPayment = {
      sale_id: selectedSale.id,
      month: selectedMonthString,
      amount_paid: baseAmountPaid,
      fine_amount: fineAmountPaid,
      date: formData.get('date'),
      receipt_no: receiptNo,
      payment_method: paymentMethod,
      cheque_no: paymentMethod === 'Cheque' ? chequeNo.trim() : null,
      cheque_date: paymentMethod === 'Cheque' ? chequeDate : null,
      attachment_url: uploadedPath,
      notes: notes
    };

    try {
      try {
        await db.rent_collections.add(newPayment);
      } catch (insertErr) {
        if (insertErr.message && (
          insertErr.message.includes('payment_method') || 
          insertErr.message.includes('cheque_no') || 
          insertErr.message.includes('cheque_date') || 
          insertErr.message.includes('attachment_url') || 
          insertErr.code === '42703'
        )) {
          const fallbackPayment = {
            sale_id: selectedSale.id,
            month: selectedMonthString,
            amount_paid: baseAmountPaid,
            fine_amount: fineAmountPaid,
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
        rentAmount: baseAmountPaid,
        fineAmount: fineAmountPaid,
        fineWaived: isFineWaived || (calculatedFine > 0 && currentFine === 0),
        originalFine: calculatedFine,
        amount_paid: amount,
        payment_method: paymentMethod,
        cheque_no: paymentMethod === 'Cheque' ? chequeNo.trim() : null,
        cheque_date: paymentMethod === 'Cheque' ? chequeDate : null
      });

      setAttachmentFile(null);
      setAttachmentPreview(null);
      setChequeNo('');
      setChequeDate('');
      setPaymentMethod('Cash');
      setIsFineWaived(false);
      setCustomFine(null);
      setIsModalOpen(false);
      setSelectedSale(null);
    } catch (err) {
      alert("Error saving rent payment: " + err.message);
    }
  };

  const handleWaiveExistingFine = async (pmt) => {
    const fineVal = parseFloat(pmt.fine_amount || 0);
    if (fineVal <= 0) return;

    const confirmed = window.confirm(
      `Confirm Fine Maafi:\n\nDo you want to remove / waive the late fine of Rs. ${fineVal.toLocaleString()} for Receipt #${pmt.receipt_no}?\n\nThis will set the fine to Rs. 0 (Fine Maafi) and update the records.`
    );
    if (!confirmed) return;

    try {
      let updatedNotes = pmt.notes || '';
      updatedNotes = `[Fine of Rs. ${fineVal.toLocaleString()} Waived (Fine Maafi) by Admin on ${new Date().toLocaleDateString()}] ` + updatedNotes;

      await db.rent_collections.update(pmt.id, {
        fine_amount: 0,
        notes: updatedNotes
      });
      alert(`Fine of Rs. ${fineVal.toLocaleString()} has been removed successfully (Fine Maafi applied).`);
    } catch (err) {
      alert("Error waiving fine: " + err.message);
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
      <RentReportPrint
        sales={activeRentSales}
        shops={shops}
        tenants={tenants}
        monthFormatted={currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        innerRef={printRentReportRef}
        projectName={activeProject?.name}
        appSettings={appSettings}
        searchQuery={searchQuery}
      />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="page-title">Rent & Maintenance</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-app)', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={handlePrevMonth}>&laquo; Prev</button>
            <span style={{ fontWeight: 600, minWidth: '140px', textAlign: 'center', fontSize: '0.95rem' }}>
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={handleNextMonth}>Next &raquo;</button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handlePrintRentReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
            title="Print Monthly Rent & Maintenance Report"
          >
            <Printer size={18} /> Print Rent Report
          </button>
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
                      {sale.balance > 0 && (() => {
                        const overdueFine = calculateFine(selectedMonthString, new Date().toISOString().split('T')[0]);
                        return overdueFine > 0 ? (
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#ef4444', marginTop: '2px' }}>
                            + Rs. {overdueFine.toLocaleString()} late fine
                          </div>
                        ) : null;
                      })()}
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
                          onClick={() => { 
                            setSelectedSale(sale); 
                            setPaymentDate(new Date().toISOString().split('T')[0]); 
                            setIsFineWaived(false);
                            setCustomFine(null);
                            setIsModalOpen(true); 
                          }}
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
        const autoFine = calculateFine(selectedMonthString, paymentDate);
        const effectiveFine = isFineWaived ? 0 : (customFine !== null ? customFine : autoFine);
        const totalDue = selectedSale.balance + effectiveFine;
        
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
                  {autoFine > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: isFineWaived ? '#059669' : '#ef4444' }}>
                        Late Fine ({Math.ceil(autoFine / 100)} days @ Rs. 100/day):
                      </p>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: isFineWaived ? '#059669' : '#ef4444' }}>
                        {isFineWaived ? 'Rs. 0 (Waived / معاف)' : `Rs. ${effectiveFine.toLocaleString()}`}
                      </p>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold' }}>Total Payable:</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold', color: '#10b981' }}>Rs. {totalDue.toLocaleString()}</p>
                  </div>

                  {/* Admin Fine Removal / Maafi Section */}
                  {autoFine > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: isFineWaived ? '#ecfdf5' : '#fff7ed',
                      border: `1px solid ${isFineWaived ? '#a7f3d0' : '#fed7aa'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, fontWeight: 700, fontSize: '0.85rem', color: isFineWaived ? '#065f46' : '#9a3412' }}>
                          <input 
                            type="checkbox" 
                            checked={isFineWaived} 
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsFineWaived(checked);
                              if (checked) setCustomFine(0);
                              else setCustomFine(null);
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#16a34a' }}
                          />
                          <span>Waive Late Fine (Fine Maafi / جرمانہ معاف)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !isFineWaived;
                            setIsFineWaived(next);
                            if (next) setCustomFine(0);
                            else setCustomFine(null);
                          }}
                          className="btn"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: isFineWaived ? '#fef2f2' : '#dcfce7',
                            color: isFineWaived ? '#991b1b' : '#15803d',
                            borderColor: isFineWaived ? '#fca5a5' : '#86efac',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {isFineWaived ? 'Undo Maafi' : 'Remove Fine (0 Rs)'}
                        </button>
                      </div>

                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: isFineWaived ? '#047857' : '#7c2d12', lineHeight: 1.4 }}>
                        {isFineWaived 
                          ? `✓ Fine Maafi Applied: The Rs. ${autoFine.toLocaleString()} fine has been removed by admin. Tenant only pays base rent.`
                          : 'Payment date is past the 10th of the month. Admin can waive or remove this fine.'}
                      </div>

                      {!isFineWaived && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px dashed #fed7aa', paddingTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#7c2d12', fontWeight: 600 }}>Custom / Partial Fine:</span>
                          <input 
                            type="number"
                            min="0"
                            max={autoFine}
                            value={customFine !== null ? customFine : autoFine}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val <= 0) {
                                setCustomFine(0);
                                setIsFineWaived(true);
                              } else {
                                setCustomFine(val);
                                setIsFineWaived(false);
                              }
                            }}
                            style={{ width: '90px', padding: '2px 6px', fontSize: '0.8rem', border: '1px solid #fed7aa', borderRadius: '4px' }}
                          />
                          <span style={{ fontSize: '0.7rem', color: '#9a3412' }}>(Rs. 0 = full waiver)</span>
                        </div>
                      )}
                    </div>
                  )}
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
                        placeholder="e.g. CHQ-102938" 
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
                          <td>
                            {pmt.receipt_no}
                            {(() => {
                              const chq = getChequeDetailsFromRent(pmt);
                              if (pmt.payment_method === 'Cheque' || chq.chequeNo) {
                                return (
                                  <span style={{ marginLeft: '6px', fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                    Cheque {chq.chequeNo ? `#${chq.chequeNo}` : ''}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </td>
                          <td>Rs. {parseFloat(pmt.amount_paid || 0).toLocaleString()}</td>
                          <td style={{ color: pmt.fine_amount > 0 ? '#ef4444' : 'inherit' }}>
                            Rs. {parseFloat(pmt.fine_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600 }}>Rs. {totalAmt.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {parseFloat(pmt.fine_amount || 0) > 0 && (
                                <button 
                                  className="btn btn-secondary"
                                  style={{ 
                                    padding: '0.2rem 0.5rem', 
                                    fontSize: '0.75rem', 
                                    color: '#047857', 
                                    borderColor: '#a7f3d0', 
                                    backgroundColor: '#ecfdf5', 
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                  title="Remove / Waive Fine for this payment (Fine Maafi)"
                                  onClick={() => handleWaiveExistingFine(pmt)}
                                >
                                  Fine Maafi
                                </button>
                              )}
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
                                onClick={() => {
                                  const chq = getChequeDetailsFromRent(pmt);
                                  triggerPrint({
                                    receipt_no: pmt.receipt_no,
                                    date: pmt.date,
                                    tenantName: getTenantDetails(selectedHistorySale.tenantId),
                                    shopDetails: getShopDetails(selectedHistorySale.shopId),
                                    month: selectedMonthString,
                                    rentAmount: parseFloat(pmt.amount_paid || 0),
                                    fineAmount: parseFloat(pmt.fine_amount || 0),
                                    amount_paid: totalAmt,
                                    payment_method: pmt.payment_method,
                                    cheque_no: chq.chequeNo,
                                    cheque_date: chq.chequeDate
                                  });
                                }}
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
