import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';
import { Plus, X, Paperclip, Download, Trash2, Printer, FileText, User, Lock, Unlock, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const TenantProfilePrint = ({ tenant, tenantSales, tenantShops, payments, innerRef, projectName }) => {
  if (!tenant) return <div ref={innerRef}></div>;
  
  const totalAmount = tenantSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalAdvance = tenantSales.reduce((sum, s) => sum + s.advancePayment, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + totalAdvance;
  const balance = totalAmount - totalPaid;

  const totalAgreedRent = tenantSales.reduce((sum, sale) => {
    const shop = tenantShops.find(s => s.id === sale.shopId);
    return sum + parseFloat(sale.monthly_rent || shop?.monthly_rent || 0);
  }, 0);

  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none' }} className="print-profile-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          .print-profile-wrapper { display: block !important; }
        `}
      </style>
      <div style={{ border: '2px solid #000', padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', textTransform: 'uppercase' }}>{projectName || 'Plaza Management'}</h1>
          <h2 style={{ margin: 0, color: '#555' }}>Tenant Profile</h2>
        </div>
        
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Personal Details</h3>
          <p style={{ margin: '5px 0' }}><strong>Name:</strong> {tenant.name}</p>
          <p style={{ margin: '5px 0' }}><strong>CNIC:</strong> {tenant.cnic}</p>
          <p style={{ margin: '5px 0' }}><strong>Mobile:</strong> {tenant.mobile}</p>
        </div>

        <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Allocated Shops</h3>
          {tenantShops.length === 0 ? <p>No shops allocated.</p> : (
            tenantShops.map(s => (
              <p key={s.id} style={{ margin: '5px 0' }}>Shop {s.shopNumber} (Block {s.block}, Floor {s.floor})</p>
            ))
          )}
        </div>

        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Financial Summary</h3>
          <p style={{ margin: '5px 0' }}><strong>Total Agreed Amount:</strong> Rs. {totalAmount.toLocaleString()}</p>
          <p style={{ margin: '5px 0' }}><strong>Total Paid (incl. Advance):</strong> Rs. {totalPaid.toLocaleString()}</p>
          <p style={{ margin: '5px 0' }}><strong>Remaining Balance:</strong> Rs. {balance.toLocaleString()}</p>
          <p style={{ margin: '5px 0' }}><strong>Agreed Rent:</strong> Rs. {totalAgreedRent.toLocaleString()} / month</p>
        </div>
      </div>
    </div>
  );
};

const TenantsListPrint = ({
  tenants,
  shops,
  sales,
  payments,
  innerRef,
  projectName,
  appSettings,
  activeSalesMap,
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

  if (!tenants) return <div ref={innerRef}></div>;

  // Pre-calculate per-tenant rows
  const tenantRows = tenants.map((tenant, idx) => {
    const activeSales = Array.from(activeSalesMap.values()).filter(s => s.tenantId === tenant.id);
    const activeShops = activeSales
      .map(s => shops.find(sh => sh.id === s.shopId && sh.status === 'Occupied'))
      .filter(Boolean);

    const shopsText = activeShops.length > 0
      ? activeShops.map(sh => `Shop ${sh.shopNumber} (${sh.block}, ${sh.floor})`).join(', ')
      : 'None (Historical)';

    const monthlyRent = activeSales.reduce((sum, sale) => {
      const sh = shops.find(s => s.id === sale.shopId);
      return sum + parseFloat(sale.monthly_rent || sh?.monthly_rent || 0);
    }, 0);

    const totalAgreed = activeSales.reduce((sum, s) => sum + parseFloat(s.totalAmount || 0), 0);
    const totalAdvance = activeSales.reduce((sum, s) => sum + parseFloat(s.advancePayment || 0), 0);

    const tenantPayments = payments.filter(p => p.tenantId === tenant.id || activeSales.some(s => s.id === p.saleId));
    const totalPaid = tenantPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + totalAdvance;
    const balance = totalAgreed - totalPaid;

    return {
      srNo: idx + 1,
      tenant,
      shopsText,
      monthlyRent,
      totalAgreed,
      totalPaid,
      balance,
    };
  });

  const grandRent = tenantRows.reduce((sum, r) => sum + r.monthlyRent, 0);
  const grandAgreed = tenantRows.reduce((sum, r) => sum + r.totalAgreed, 0);
  const grandPaid = tenantRows.reduce((sum, r) => sum + r.totalPaid, 0);
  const grandBalance = tenantRows.reduce((sum, r) => sum + r.balance, 0);

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={innerRef} className="print-all-tenants-wrapper" style={{ display: 'none', padding: '24px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; }
          .print-all-tenants-wrapper { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-row-group; page-break-inside: avoid; }
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
              TENANTS DIRECTORY & SHOP ALLOCATIONS REPORT
            </h2>
            {searchQuery && (
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                Filtered by: "{searchQuery}"
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Date:</strong> {formattedDate}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Time:</strong> {formattedTime}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Tenants:</strong> {tenantRows.length}</p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: 1.4 }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f172a' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>#</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Tenant Name</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '125px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>CNIC Number</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Mobile Number</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Allocated Shop(s)</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '95px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Rent / Mo</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Agreed Amount</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Total Paid</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '110px', fontWeight: 700 }}>Remaining Balance</th>
          </tr>
        </thead>
        <tbody>
          {tenantRows.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                No active tenants found.
              </td>
            </tr>
          ) : (
            tenantRows.map((r, i) => (
              <tr
                key={r.tenant.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>
                  {r.srNo}
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                  {r.tenant.name}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', borderRight: '1px solid #e2e8f0' }}>
                  {r.tenant.cnic || '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', borderRight: '1px solid #e2e8f0' }}>
                  {r.tenant.mobile || '—'}
                </td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>
                  {r.shopsText}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                  {r.monthlyRent > 0 ? `Rs. ${r.monthlyRent.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                  {r.totalAgreed > 0 ? `Rs. ${r.totalAgreed.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #e2e8f0', color: '#0f766e', fontWeight: 500 }}>
                  {r.totalPaid > 0 ? `Rs. ${r.totalPaid.toLocaleString()}` : '—'}
                </td>
                <td style={{
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: r.balance > 0 ? '#b91c1c' : '#15803d',
                }}>
                  Rs. {r.balance.toLocaleString()}
                </td>
              </tr>
            ))
          )}
          {tenantRows.length > 0 && (
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700, pageBreakInside: 'avoid' }}>
              <td colSpan="5" style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                TOTALS ({tenantRows.length} {tenantRows.length === 1 ? 'TENANT' : 'TENANTS'})
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                Rs. {grandRent.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                Rs. {grandAgreed.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>
                Rs. {grandPaid.toLocaleString()}
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: grandBalance > 0 ? '#b91c1c' : '#15803d' }}>
                Rs. {grandBalance.toLocaleString()}
              </td>
            </tr>
          )}
        </tbody>
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

export default function Tenants({ currentUser }) {
  const db = useDb();
  const { activeProject } = useProject();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleUnlock = () => {
    const code = window.prompt("SAFETY LOCK ACTIVE\n\nTo unlock tenant deletion, type 'CONFIRM':");
    if (code === 'CONFIRM') {
      setIsUnlocked(true);
    } else if (code !== null) {
      alert("Invalid confirmation code.");
    }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedTenantForDocs, setSelectedTenantForDocs] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedTenantProfile, setSelectedTenantProfile] = useState(null);
  const printRef = useRef(null);
  const printAllRef = useRef(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintAllTenants = useReactToPrint({
    contentRef: printAllRef,
    documentTitle: `${activeProject?.name || 'Plaza'}_Tenants_Directory`,
  });
  
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedShopId, setSelectedShopId] = useState('');
  const [cnicVal, setCnicVal] = useState('');
  const [mobileVal, setMobileVal] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null); // null = idle, 0-100 = uploading

  useEffect(() => {
    if (location.state?.preSelectShopId) {
      setSelectedShopId(location.state.preSelectShopId.toString());
      setIsModalOpen(true);
      const state = { ...location.state };
      delete state.preSelectShopId;
      navigate(location.pathname, { state, replace: true });
    }
  }, [location.state, location.pathname, navigate]);
  
  const tenants = useSupabase('tenants') || [];
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];
  const documents = useSupabase('documents') || [];
  const installments = useSupabase('installments') || [];
  const appSettingsList = useSupabase('app_settings') || [];
  const appSettings = appSettingsList.length > 0 ? appSettingsList[0] : null;
  
  const availableShops = shops.filter(s => s.status === 'Available');

  const activeSalesMap = useMemo(() => {
    const map = new Map();
    sales.forEach(s => {
      const existing = map.get(s.shopId);
      if (!existing || new Date(s.date || 0) > new Date(existing.date || 0)) {
        map.set(s.shopId, s);
      }
    });
    return map;
  }, [sales]);

  const getShopDetails = (tenantId) => {
    const activeTenantShops = Array.from(activeSalesMap.values())
      .filter(s => s.tenantId === tenantId)
      .map(s => {
        const shop = shops.find(sh => sh.id === s.shopId);
        return shop && shop.status === 'Occupied' ? shop : null;
      })
      .filter(Boolean);
      
    if (activeTenantShops.length === 0) return 'None (Historical)';
    
    return activeTenantShops.map(shop => 
      `Shop ${shop.shopNumber} (Block ${shop.block}, Floor ${shop.floor})`
    ).join(', ');
  };

  const handleDeleteTenant = async (tenant) => {
    if (window.confirm(`Are you sure you want to delete ${tenant.name}? This will remove all their sales, installments, and payment records, and free up their shops.`)) {
      try {
        const tenantSales = sales.filter(s => s.tenantId === tenant.id);
        
        for (const sale of tenantSales) {
          // Find and delete child records
          const insts = installments.filter(i => i.saleId === sale.id);
          const pmts = payments.filter(p => p.saleId === sale.id);
          for (const i of insts) await db.installments.delete(i.id);
          for (const p of pmts) await db.payments.delete(p.id);
          
          // Delete sale and free shop
          await db.sales.delete(sale.id);
          await db.shops.update(sale.shopId, { status: 'Available' });
        }
        
        // Delete documents
        const docs = documents.filter(d => d.tenantId === tenant.id);
        for (const d of docs) await db.documents.delete(d.id);
        
        // Finally, delete the tenant
        await db.tenants.delete(tenant.id);
      } catch (err) {
        console.error("Error deleting tenant:", err);
        alert("Failed to delete tenant. Check console for details.");
      }
    }
  };

  const formatCNIC = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 13) val = val.slice(0, 13);
    let formatted = '';
    if (val.length > 0) formatted += val.substring(0, 5);
    if (val.length > 5) formatted += '-' + val.substring(5, 12);
    if (val.length > 12) formatted += '-' + val.substring(12, 13);
    e.target.value = formatted;
  };

  const formatMobile = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    let formatted = '';
    if (val.length > 0) formatted += val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 11);
    e.target.value = formatted;
  };

  const handleAddTenant = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    if (!selectedShopId) {
      alert('Please select a shop.');
      return;
    }

    const cnic = formData.get('cnic');
    const mobile = formData.get('mobile');

    // Validate CNIC: must be exactly XXXXX-XXXXXXX-X
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic)) {
      alert('❌ Invalid CNIC format.\n\nRequired format: XXXXX-XXXXXXX-X\nExample: 35201-1234567-8\n\nPlease enter all 13 digits in the correct format.');
      return;
    }

    // Validate Mobile: must be exactly XXXX-XXXXXXX
    const mobileRegex = /^\d{4}-\d{7}$/;
    if (!mobileRegex.test(mobile)) {
      alert('❌ Invalid mobile number format.\n\nRequired format: XXXX-XXXXXXX\nExample: 0300-1234567\n\nPlease enter all 11 digits in the correct format.');
      return;
    }

    const newTenant = {
      name: formData.get('name'),
      cnic,
      mobile
    };

    try {
      const tenantId = await db.tenants.add(newTenant);

      const selectedShop = shops.find(s => s.id === selectedShopId);
      const shopPrice = selectedShop ? parseFloat(selectedShop.price || 0) : 0;

      const newSale = {
        shopId: selectedShopId,
        tenantId: tenantId,
        date: formData.get('date'),
        totalAmount: shopPrice,
        advancePayment: parseFloat(formData.get('advancePayment') || 0),
        isCompleted: false
      };

      await db.sales.add(newSale);
      // Update shop status AND sync its price to the actual sale amount
      await db.shops.update(selectedShopId, { status: 'Occupied', price: newSale.totalAmount });

      setSelectedShopId('');
      setCnicVal('');
      setMobileVal('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error registering tenant:', err);
      alert('Failed to register tenant. Error: ' + err.message);
    }
  };

  // --- Documents Logic ---
  const handleOpenDocs = (tenant) => {
    setSelectedTenantForDocs(tenant);
    setIsDocModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTenantForDocs) return;

    const filePath = `${selectedTenantForDocs.id}/${Date.now()}_${file.name}`;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;

    setUploadProgress(0);

    // Use XHR for real progress events
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/tenant-documents/${filePath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('x-upsert', 'false');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Storage upload failed (${xhr.status}): ${xhr.responseText}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));

      const formData = new FormData();
      formData.append('', file);
      xhr.send(file);
    }).catch(err => {
      setUploadProgress(null);
      alert('Upload failed: ' + err.message);
      e.target.value = null;
      throw err;
    });

    // Save metadata to DB
    try {
      const { error: dbError } = await supabase.from('documents').insert({
        project_id: activeProject.id,
        tenantId: selectedTenantForDocs.id,
        name: file.name,
        type: file.type,
        date: new Date().toISOString(),
        storage_path: filePath,
        file_url: filePath
      });

      if (dbError) {
        await supabase.storage.from('tenant-documents').remove([filePath]);
        throw new Error('DB save failed: ' + dbError.message);
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }

    setUploadProgress(null);
    e.target.value = null;
  };

  const handleDownloadDoc = async (doc) => {
    try {
      const path = doc.storage_path || doc.storagePath;
      const { data, error } = await supabase.storage
        .from('tenant-documents')
        .createSignedUrl(path, 60);
      if (error) throw error;
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = doc.name;
      a.target = '_blank';
      a.click();
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const path = doc.storage_path || doc.storagePath;
      if (path) await supabase.storage.from('tenant-documents').remove([path]);
      await db.documents.delete(doc.id);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };


  const currentTenantDocs = selectedTenantForDocs 
    ? documents.filter(d => d.tenantId === selectedTenantForDocs.id)
    : [];

  const getProfileData = () => {
    if (!selectedTenantProfile) return null;
    const tSales = sales.filter(s => s.tenantId === selectedTenantProfile.id);
    const tShops = tSales.map(s => shops.find(sh => sh.id === s.shopId)).filter(Boolean);
    const tPayments = payments.filter(p => tSales.some(s => s.id === p.saleId) || p.tenantId === selectedTenantProfile.id);
    
    return {
      tenant: selectedTenantProfile,
      tenantSales: tSales,
      tenantShops: tShops,
      payments: tPayments
    };
  };
  const profileData = getProfileData();

  const floorOrder = (name = '') => {
    const n = name.toLowerCase().trim();
    if (n.includes('ground')) return 0;
    if (n.includes('first')  || n === '1st') return 1;
    if (n.includes('second') || n === '2nd') return 2;
    if (n.includes('third')  || n === '3rd') return 3;
    if (n.includes('fourth') || n === '4th') return 4;
    const num = parseInt(n);
    return isNaN(num) ? 99 : num + 10;
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.cnic.includes(searchQuery) ||
                            (t.mobile && t.mobile.includes(searchQuery));
      
      const activeShopStr = getShopDetails(t.id);
      const hasActiveShop = activeShopStr !== 'None (Historical)' && activeShopStr !== 'None';
      
      return matchesSearch && hasActiveShop;
    });
  }, [tenants, searchQuery, activeSalesMap, shops]);

  const sortedTenants = useMemo(() => {
    return [...filteredTenants].sort((a, b) => {
      const saleA = sales.find(s => s.tenantId === a.id);
      const saleB = sales.find(s => s.tenantId === b.id);
      const shopA = saleA ? shops.find(s => s.id === saleA.shopId) : null;
      const shopB = saleB ? shops.find(s => s.id === saleB.shopId) : null;

      // Block: alphabetical (A, B, C...)
      const blockCmp = (shopA?.block || '').localeCompare(shopB?.block || '');
      if (blockCmp !== 0) return blockCmp;

      // Floor: Ground → First → Second...
      const floorCmp = floorOrder(shopA?.floor) - floorOrder(shopB?.floor);
      if (floorCmp !== 0) return floorCmp;

      // Shop Number: numeric ascending
      return parseInt(shopA?.shopNumber || 0) - parseInt(shopB?.shopNumber || 0);
    });
  }, [filteredTenants, sales, shops]);

  return (
    <div>
      <TenantProfilePrint 
        innerRef={printRef}
        tenant={profileData?.tenant}
        tenantSales={profileData?.tenantSales}
        tenantShops={profileData?.tenantShops}
        payments={profileData?.payments}
        projectName={activeProject?.name}
      />
      <TenantsListPrint
        innerRef={printAllRef}
        tenants={sortedTenants}
        shops={shops}
        sales={sales}
        payments={payments}
        projectName={activeProject?.name}
        appSettings={appSettings}
        activeSalesMap={activeSalesMap}
        searchQuery={searchQuery}
      />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="page-title">Tenants Directory</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrintAllTenants}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
            title="Print Full Tenants Directory Report"
          >
            <Printer size={18} /> Print Tenants List
          </button>
          {currentUser?.isAdmin && (
            <button 
              className={`btn ${isUnlocked ? 'btn-secondary' : 'btn-primary'}`}
              style={{ backgroundColor: isUnlocked ? undefined : '#ef4444', borderColor: isUnlocked ? undefined : '#ef4444', color: isUnlocked ? '#ef4444' : 'white' }}
              onClick={isUnlocked ? () => setIsUnlocked(false) : handleUnlock}
            >
              {isUnlocked ? <Lock size={16} /> : <Unlock size={16} />}
              {isUnlocked ? 'Lock Deletion' : 'Unlock Deletion'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); }}>
            <Plus size={18} /> Register Tenant & Allocate Shop
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search tenants by name, CNIC, or mobile..." 
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
                <th>Name</th>
                <th>CNIC No.</th>
                <th>Mobile Number</th>
                <th>Allocated Shop</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTenants.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    {searchQuery ? 'No tenants match your search query.' : 'No tenants found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                sortedTenants.map(tenant => (
                  <tr key={tenant.id}>
                    <td>
                      <span 
                        className="action-link"
                        onClick={() => { setSelectedTenantProfile(tenant); setIsProfileModalOpen(true); }}
                        title="Click to view full profile"
                      >
                        {tenant.name}
                      </span>
                    </td>
                    <td>{tenant.cnic}</td>
                    <td>{tenant.mobile}</td>
                    <td>{getShopDetails(tenant.id)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenDocs(tenant)}
                        title="Manage Documents"
                      >
                        <Paperclip size={14} /> Docs
                      </button>
                      {isUnlocked && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#f87171', marginLeft: '0.5rem' }}
                          onClick={() => handleDeleteTenant(tenant)}
                          title="Delete Tenant"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Register Tenant & Allocate Shop</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTenant}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Tenant Details</h3>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" name="name" className="form-control" required />
              </div>
              <div className="form-group">
                <label className="form-label">CNIC No.</label>
                <input
                  type="text"
                  name="cnic"
                  className="form-control"
                  required
                  placeholder="XXXXX-XXXXXXX-X"
                  maxLength="15"
                  value={cnicVal}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                    let fmt = '';
                    if (val.length > 0) fmt += val.substring(0, 5);
                    if (val.length > 5) fmt += '-' + val.substring(5, 12);
                    if (val.length > 12) fmt += '-' + val.substring(12, 13);
                    setCnicVal(fmt);
                  }}
                  style={{
                    borderColor: cnicVal.length === 0 ? undefined
                      : /^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '#16a34a' : '#ef4444'
                  }}
                />
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0,
                  color: cnicVal.length === 0 ? 'var(--color-text-muted)'
                    : /^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '#16a34a' : '#ef4444' }}>
                  {/^\d{5}-\d{7}-\d{1}$/.test(cnicVal) ? '✓ Valid CNIC' : 'Format: XXXXX-XXXXXXX-X (13 digits)'}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  name="mobile"
                  className="form-control"
                  required
                  placeholder="XXXX-XXXXXXX"
                  maxLength="12"
                  value={mobileVal}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let fmt = '';
                    if (val.length > 0) fmt += val.substring(0, 4);
                    if (val.length > 4) fmt += '-' + val.substring(4, 11);
                    setMobileVal(fmt);
                  }}
                  style={{
                    borderColor: mobileVal.length === 0 ? undefined
                      : /^\d{4}-\d{7}$/.test(mobileVal) ? '#16a34a' : '#ef4444'
                  }}
                />
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0,
                  color: mobileVal.length === 0 ? 'var(--color-text-muted)'
                    : /^\d{4}-\d{7}$/.test(mobileVal) ? '#16a34a' : '#ef4444' }}>
                  {/^\d{4}-\d{7}$/.test(mobileVal) ? '✓ Valid mobile number' : 'Format: XXXX-XXXXXXX (11 digits)'}
                </p>
              </div>

              <h3 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Shop Allocation Details</h3>

              <div className="form-group">
                <label className="form-label">Date of Allocation</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="form-group">
                <label className="form-label">Select Available Shop</label>
                <select
                  className="form-control"
                  required
                  value={selectedShopId}
                  onChange={e => setSelectedShopId(e.target.value)}
                >
                  <option value="">-- Select Available Shop --</option>
                  {availableShops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      Shop {shop.shopNumber} — Block {shop.block}, {shop.floor}{shop.side ? ` (${shop.side} Side)` : ''}
                    </option>
                  ))}
                </select>
              </div>



              <div className="form-group">
                <label className="form-label">Advance Payment (Rs.)</label>
                <input
                  type="number"
                  name="advancePayment"
                  className="form-control"
                  min="0" step="0.01"
                  defaultValue="0"
                />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={availableShops.length === 0}>Complete Registration</button>
              </div>
              {availableShops.length === 0 && (
                <p style={{ color: 'var(--color-warning-text)', fontSize: '0.875rem', marginTop: '1rem', textAlign: 'center' }}>
                  No available shops to allocate. Please add shops first.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {isDocModalOpen && selectedTenantForDocs && (
        <div className="modal-overlay" onClick={() => setIsDocModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Documents: {selectedTenantForDocs.name}</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {getShopDetails(selectedTenantForDocs.id)}
              </p>
              <button className="modal-close" onClick={() => setIsDocModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', textAlign: 'center', marginBottom: '1.5rem' }}>
              {uploadProgress !== null ? (
                <div style={{ padding: '0.5rem 0' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: 'var(--color-primary)' }}>
                    Uploading... {uploadProgress}%
                  </p>
                  <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: '999px',
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Please wait...
                  </p>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Paperclip size={24} color="#64748b" />
                  <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Click to Upload Document</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Max recommended size: 5MB per file)</span>
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              )}
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Attached Documents</h3>
            {currentTenantDocs.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentTenantDocs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <FileText size={18} color="#64748b" />
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(doc.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDownloadDoc(doc)} title="Download">
                        <Download size={14} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={() => handleDeleteDoc(doc)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDocModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isProfileModalOpen && profileData && (
        <div className="modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Tenant Profile</h2>
              <button className="btn btn-secondary" onClick={handlePrint} style={{ marginLeft: 'auto', marginRight: '1rem', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={16} /> Print Profile
              </button>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <User size={18} /> Personal Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Name</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{profileData.tenant.name}</p>
                  
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>CNIC</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{profileData.tenant.cnic}</p>
                  
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Mobile</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{profileData.tenant.mobile}</p>
                </div>
              </div>

              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <FileText size={18} /> Allocated Shops
                </h3>
                {profileData.tenantShops.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No shops currently allocated.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {profileData.tenantShops.map(s => (
                      <li key={s.id} style={{ marginBottom: '0.25rem', fontWeight: 500 }}>
                        Shop {s.shopNumber} (Block {s.block}, Floor {s.floor})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #bbf7d0', paddingBottom: '0.5rem', color: '#166534' }}>
                  Financial Summary
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <p style={{ margin: 0, color: '#15803d', fontSize: '0.875rem' }}>Total Agreed Amount</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>Rs. {profileData.tenantSales.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</p>
                  
                  <p style={{ margin: 0, color: '#15803d', fontSize: '0.875rem' }}>Total Paid (incl. Advance)</p>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-primary)' }}>
                    Rs. {(profileData.payments.reduce((sum, p) => sum + p.amount, 0) + profileData.tenantSales.reduce((sum, s) => sum + s.advancePayment, 0)).toLocaleString()}
                  </p>
                  
                  <p style={{ margin: 0, color: '#15803d', fontSize: '0.875rem' }}>Remaining Balance</p>
                  <p style={{ margin: 0, fontWeight: 600, color: '#ef4444' }}>
                    Rs. {(profileData.tenantSales.reduce((sum, s) => sum + s.totalAmount, 0) - (profileData.payments.reduce((sum, p) => sum + p.amount, 0) + profileData.tenantSales.reduce((sum, s) => sum + s.advancePayment, 0))).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
