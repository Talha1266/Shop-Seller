import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';
import { Plus, X, Paperclip, Download, Trash2, CheckCircle, Circle, HardHat, DollarSign, Wallet } from 'lucide-react';

const REQUIRED_DOCS = [
  "Contractor's Bill",
  "Application",
  "Committee Inspection Report",
  "Sanction Order",
  "Acquaintance Role"
];

export default function Contractor() {
  const db = useDb();
  const { activeProject } = useProject();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);

  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];
  const contractorPayments = useSupabase('contractor_payments') || [];
  const contractorDocuments = useSupabase('contractor_documents') || [];

  // Calculate Max Revenue (Target)
  const activeSales = sales.filter(s => shops.some(shop => shop.id === s.shopId && shop.status === 'Occupied'));
  
  const maxPotentialRevenue = shops.reduce((sum, shop) => {
    if (shop.status === 'Occupied') {
      const sale = activeSales.find(s => s.shopId === shop.id);
      return sum + (sale ? parseFloat(sale.totalAmount || 0) : parseFloat(shop.price || 0));
    } else {
      return sum + parseFloat(shop.price || 0);
    }
  }, 0);

  // Calculate Revenue Collected
  const totalReceived = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) +
                        activeSales.reduce((sum, sale) => sum + parseFloat(sale.advancePayment || 0), 0);

  // Calculate Contractor Paid
  const totalContractorPaid = contractorPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      await db.contractor_payments.add({
        date: formData.get('date'),
        amount: amount,
        notes: formData.get('notes') || ''
      });
      setIsPaymentModalOpen(false);
    } catch (err) {
      alert("Failed to add payment: " + err.message);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment? All associated documents will also be deleted.")) return;
    try {
      // Find associated docs
      const docs = contractorDocuments.filter(d => d.payment_id === paymentId);
      for (const doc of docs) {
        if (doc.storage_path) {
          await supabase.storage.from('contractor-documents').remove([doc.storage_path]);
        }
      }
      // Delete docs from DB (ON DELETE CASCADE handles this if foreign keys are set up, but let's be safe)
      await supabase.from('contractor_documents').delete().eq('payment_id', paymentId);
      
      // Delete payment
      await db.contractor_payments.delete(paymentId);
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const openDocChecklist = (payment) => {
    setSelectedPayment(payment);
    setIsDocModalOpen(true);
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file || !selectedPayment) return;

    const filePath = `${selectedPayment.id}/${Date.now()}_${file.name}`;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setUploadingDocType(docType);
    setUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || supabaseKey;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/contractor-documents/${filePath}`);
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

        xhr.send(file);
      });

      const { error: dbError } = await supabase.from('contractor_documents').insert({
        project_id: activeProject.id,
        payment_id: selectedPayment.id,
        document_type: docType,
        name: file.name,
        storage_path: filePath,
        file_url: filePath
      });

      if (dbError) {
        await supabase.storage.from('contractor-documents').remove([filePath]);
        throw new Error('DB save failed: ' + dbError.message);
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadProgress(null);
      setUploadingDocType(null);
      e.target.value = null;
    }
  };

  const handleDownloadDoc = async (doc) => {
    try {
      const { data, error } = await supabase.storage
        .from('contractor-documents')
        .createSignedUrl(doc.storage_path, 60);
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
      if (doc.storage_path) await supabase.storage.from('contractor-documents').remove([doc.storage_path]);
      await db.contractor_documents.delete(doc.id);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const currentDocs = selectedPayment ? contractorDocuments.filter(d => d.payment_id === selectedPayment.id) : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Contractor Payments</h1>
        <button className="btn btn-primary" onClick={() => setIsPaymentModalOpen(true)}>
          <Plus size={18} /> Record Payment
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardHat size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Total Max Rev (Contract Value)</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>Rs. {maxPotentialRevenue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Revenue Collected</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>Rs. {totalReceived.toLocaleString()}</h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Total Paid to Contractor</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>Rs. {totalContractorPaid.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount Paid</th>
                <th>Notes</th>
                <th>Checklist Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contractorPayments.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No contractor payments recorded yet.</td></tr>
              ) : (
                contractorPayments.map(payment => {
                  const pDocs = contractorDocuments.filter(d => d.payment_id === payment.id);
                  const missingCount = REQUIRED_DOCS.length - pDocs.length;
                  const isComplete = missingCount <= 0;

                  return (
                    <tr key={payment.id}>
                      <td style={{ fontWeight: 500 }}>{new Date(payment.date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Rs. {payment.amount.toLocaleString()}</td>
                      <td>{payment.notes || '-'}</td>
                      <td>
                        {isComplete ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12}/> Complete</span>
                        ) : (
                          <span className="badge badge-warning">{missingCount} Missing</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                          onClick={() => openDocChecklist(payment)}
                        >
                          <Paperclip size={14} /> Checklist
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#f87171' }}
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Contractor Payment</h2>
              <button className="modal-close" onClick={() => setIsPaymentModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (Rs.)</label>
                <input type="number" name="amount" className="form-control" required min="1" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea name="notes" className="form-control" rows="2" placeholder="Cheque number, description, etc."></textarea>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDocModalOpen && selectedPayment && (
        <div className="modal-overlay" onClick={() => setIsDocModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Document Checklist</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Payment on {new Date(selectedPayment.date).toLocaleDateString()} for Rs. {selectedPayment.amount.toLocaleString()}
              </p>
              <button className="modal-close" onClick={() => setIsDocModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {REQUIRED_DOCS.map((docType) => {
                const existingDoc = currentDocs.find(d => d.document_type === docType);
                const isUploadingThis = uploadingDocType === docType;
                
                return (
                  <div key={docType} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: existingDoc ? '#f0fdf4' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {existingDoc ? <CheckCircle size={20} color="#16a34a" /> : <Circle size={20} color="#94a3b8" />}
                      <div>
                        <p style={{ margin: 0, fontWeight: 500, color: existingDoc ? '#166534' : 'var(--color-text)' }}>{docType}</p>
                        {existingDoc && <p style={{ margin: 0, fontSize: '0.75rem', color: '#15803d' }}>{existingDoc.name}</p>}
                      </div>
                    </div>
                    
                    <div>
                      {isUploadingThis ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                          Uploading {uploadProgress}%...
                        </span>
                      ) : existingDoc ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDownloadDoc(existingDoc)} title="Download">
                            <Download size={14} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={() => handleDeleteDoc(existingDoc)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                          Upload
                          <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, docType)} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDocModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
