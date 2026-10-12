import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useDb } from '../hooks/useDb';
import { useSupabase } from '../hooks/useSupabase';
import { 
  Fuel, ArrowLeft, Calendar, MapPin, Maximize, FileText, 
  TrendingUp, DollarSign, CheckCircle2, Clock, Printer, 
  Plus, Trash2, Edit3, X, AlertCircle
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

// Helper to format date YYYY-MM-DD to DD/MM/YYYY
export const formatDate = (d) => {
  if (!d) return '';
  try {
    const parts = String(d).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }
    return d;
  } catch {
    return d;
  }
};

// Printable Receipt Component for Petrol Pump
const PetrolPumpReceiptPrint = ({ printData, innerRef, pump, appSettings }) => {
  const [signatureUrl, setSignatureUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

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
          if (data) setLogoUrl(data.signedUrl);
        });
    }
  }, [appSettings?.auth_signature_url, appSettings?.watermark_url]);

  if (!printData || !pump) return <div ref={innerRef}></div>;

  const periodText = (printData.period_from && printData.period_to)
    ? `${formatDate(printData.period_from)} to ${formatDate(printData.period_to)}`
    : (printData.month || 'N/A');

  return (
    <div ref={innerRef} style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', display: 'none' }} className="print-receipt-wrapper">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          .print-receipt-wrapper { display: block !important; }
        `}
      </style>
      
      <div style={{ border: '2px solid #000', padding: '30px', maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ maxHeight: '100px', maxWidth: '120px', objectFit: 'contain', mixBlendMode: 'multiply', marginRight: '20px' }} 
            />
          )}
          
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', textTransform: 'uppercase', lineHeight: '1.2' }}>
              POLICE WELFARE PETROL PUMP
            </h1>
            {pump.location && (
              <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#333', fontWeight: 600 }}>
                {pump.location}
              </p>
            )}
            <h2 style={{ margin: 0, color: '#444', fontSize: '16px', letterSpacing: '1px' }}>
              PETROL PUMP LEASE RENT RECEIPT
            </h2>
          </div>
        </div>

        {/* Receipt Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div><strong>Receipt No:</strong> {printData.receipt_no}</div>
          <div><strong>Payment Date:</strong> {formatDate(printData.date)}</div>
        </div>

        {/* Property & Rent Period Details */}
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
          <p style={{ margin: '4px 0' }}><strong>Site Name:</strong> {pump.name}</p>
          <p style={{ margin: '4px 0' }}><strong>Site Location:</strong> {pump.location || 'N/A'}</p>
          <p style={{ margin: '4px 0' }}>
            <strong>Rent Paid For Duration:</strong> {periodText}
          </p>
          {printData.payment_method && (
            <p style={{ margin: '4px 0' }}><strong>Payment Mode:</strong> {printData.payment_method}</p>
          )}
        </div>

        {/* Financial Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'left', padding: '8px 0' }}>Description</th>
              <th style={{ borderBottom: '2px solid #000', textAlign: 'right', padding: '8px 0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>Lease Rent ({periodText})</td>
              <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', textAlign: 'right' }}>Rs. {Number(printData.amount_paid).toLocaleString()}</td>
            </tr>
            {printData.fine_amount > 0 && (
              <tr>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>Late Charges</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid #eee', textAlign: 'right' }}>Rs. {Number(printData.fine_amount).toLocaleString()}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '14px 0', fontWeight: 'bold', fontSize: '1.1em' }}>Total Amount Paid</td>
              <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '1.2em' }}>
                Rs. {(Number(printData.amount_paid) + Number(printData.fine_amount || 0)).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures & Stamp */}
        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ width: '200px', textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>Lessee Signature</p>
            </div>
          </div>

          <div style={{ width: '250px', textAlign: 'center' }}>
            {signatureUrl && (
              <img 
                src={signatureUrl} 
                alt="Signature" 
                style={{ maxHeight: '60px', marginBottom: '5px', objectFit: 'contain', mixBlendMode: 'multiply' }} 
              />
            )}
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{appSettings?.auth_name || 'Authorized Signatory'}</p>
              {appSettings?.auth_department && <p style={{ margin: '2px 0', fontSize: '12px', color: '#555' }}>{appSettings.auth_department}</p>}
              {appSettings?.auth_branch && <p style={{ margin: '2px 0', fontSize: '12px', color: '#555' }}>{appSettings.auth_branch}</p>}
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '40px', textAlign: 'center', color: '#000', fontSize: '16px', fontWeight: 'bold' }}>
          Thank you for your payment!
        </div>
      </div>
    </div>
  );
};

export default function PetrolPumpDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDb();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'schedule', 'collections'
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMonthStr, setSelectedMonthStr] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [printData, setPrintData] = useState(null);

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  // Fetch petrol pump
  const allPumps = useSupabase('petrol_pumps') || [];
  const pump = useMemo(() => allPumps.find(p => p.id === id), [allPumps, id]);

  // Fetch collections for this petrol pump
  const allCollections = useSupabase('petrol_pump_rent_collections') || [];
  const pumpCollections = useMemo(() => {
    return allCollections
      .filter(c => c.petrol_pump_id === id)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [allCollections, id]);

  // App settings for receipt branding
  const appSettingsList = useSupabase('app_settings') || [];
  const appSettings = appSettingsList.length > 0 ? appSettingsList[0] : null;

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    location: '',
    total_area: '',
    lease_deed_reg_date: '',
    total_lease_period: '',
    lease_start_date: '',
    lease_end_date: '',
    grace_period: '',
    monthly_rent: '',
    annual_increase_pct: ''
  });

  useEffect(() => {
    if (pump) {
      setEditForm({
        name: pump.name || '',
        location: pump.location || '',
        total_area: pump.total_area || '',
        lease_deed_reg_date: pump.lease_deed_reg_date || '',
        total_lease_period: pump.total_lease_period || '',
        lease_start_date: pump.lease_start_date || '',
        lease_end_date: pump.lease_end_date || '',
        grace_period: pump.grace_period || '',
        monthly_rent: pump.monthly_rent || '',
        annual_increase_pct: pump.annual_increase_pct || ''
      });
    }
  }, [pump]);

  // Calculate year-by-year escalation schedule
  const escalationSchedule = useMemo(() => {
    if (!pump) return [];
    
    const baseRent = Number(pump.monthly_rent) || 0;
    const annualIncreasePct = Number(pump.annual_increase_pct) || 0;
    const startDate = pump.lease_start_date ? new Date(pump.lease_start_date) : new Date();
    
    // Determine total years
    let totalYears = 30; // default standard lease
    if (pump.total_lease_period) {
      const match = pump.total_lease_period.match(/\d+/);
      if (match) totalYears = parseInt(match[0], 10);
    } else if (pump.lease_end_date && pump.lease_start_date) {
      const diffYears = (new Date(pump.lease_end_date) - new Date(pump.lease_start_date)) / (365.25 * 24 * 3600 * 1000);
      if (diffYears > 0) totalYears = Math.round(diffYears);
    }

    if (totalYears <= 0 || totalYears > 99) totalYears = 30;

    const today = new Date();
    const schedule = [];

    for (let y = 1; y <= totalYears; y++) {
      const yearStart = new Date(startDate);
      yearStart.setFullYear(startDate.getFullYear() + (y - 1));

      const yearEnd = new Date(startDate);
      yearEnd.setFullYear(startDate.getFullYear() + y);
      yearEnd.setDate(yearEnd.getDate() - 1);

      // Rent compounding annually
      const monthlyRent = Math.round(baseRent * Math.pow(1 + (annualIncreasePct / 100), y - 1));
      const annualRent = monthlyRent * 12;

      const isCurrentYear = today >= yearStart && today <= yearEnd;
      const isPastYear = today > yearEnd;

      schedule.push({
        yearNumber: y,
        startDate: yearStart.toISOString().split('T')[0],
        endDate: yearEnd.toISOString().split('T')[0],
        monthlyRent,
        annualRent,
        increaseRate: y === 1 ? 0 : annualIncreasePct,
        isCurrentYear,
        isPastYear
      });
    }

    return schedule;
  }, [pump]);

  // Find current year's expected monthly rent
  const currentExpectedMonthlyRent = useMemo(() => {
    const currentYear = escalationSchedule.find(s => s.isCurrentYear);
    if (currentYear) return currentYear.monthlyRent;
    return Number(pump?.monthly_rent) || 0;
  }, [escalationSchedule, pump]);

  // Current month string 'YYYY-MM'
  const currentMonthStr = useMemo(() => {
    return `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
  }, [currentMonthDate]);

  // Helper to enrich payment data for receipt printing and duration parsing
  const getEnrichedPaymentData = (payment) => {
    if (!payment) return null;
    let from = payment.period_from;
    let to = payment.period_to;

    // Check if period_from/to are stored in notes or month
    if (!from || !to) {
      if (payment.notes && payment.notes.includes('Duration:')) {
        const match = payment.notes.match(/Duration:\s*(\S+)\s*to\s*(\S+)/);
        if (match) {
          from = from || match[1];
          to = to || match[2];
        }
      }
      if ((!from || !to) && payment.month && payment.month.includes(' to ')) {
        const parts = payment.month.split(' to ');
        if (parts.length === 2) {
          from = from || parts[0].trim();
          to = to || parts[1].trim();
        }
      }
      // If payment.month is standard 'YYYY-MM'
      if ((!from || !to) && payment.month && payment.month.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = payment.month.split('-').map(Number);
        from = from || `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        to = to || `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    return {
      ...payment,
      period_from: from,
      period_to: to
    };
  };

  // Check if current month is paid (direct month match or covered by a multi-month period)
  const currentMonthPayment = useMemo(() => {
    const curYear = currentMonthDate.getFullYear();
    const curMonth = currentMonthDate.getMonth() + 1;
    const monthStart = new Date(curYear, curMonth - 1, 1);
    const monthEnd = new Date(curYear, curMonth, 0);

    return pumpCollections.find(c => {
      // 1. Direct match with month string 'YYYY-MM'
      if (c.month === currentMonthStr) return true;

      // 2. Check period_from and period_to range overlap
      const enriched = getEnrichedPaymentData(c);
      if (enriched?.period_from && enriched?.period_to) {
        const pStart = new Date(enriched.period_from);
        const pEnd = new Date(enriched.period_to);
        if (!isNaN(pStart.getTime()) && !isNaN(pEnd.getTime())) {
          if (monthStart <= pEnd && monthEnd >= pStart) {
            return true;
          }
        }
      }
      return false;
    });
  }, [pumpCollections, currentMonthStr, currentMonthDate]);

  // Handle open receive payment modal
  const handleOpenReceive = (monthStr) => {
    setSelectedMonthStr(monthStr || currentMonthStr);
    const targetDate = monthStr ? new Date(`${monthStr}-01`) : currentMonthDate;
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const sDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const eDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    setPeriodFrom(sDate);
    setPeriodTo(eDate);
    setPaymentAmount(currentExpectedMonthlyRent);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Handle preset duration button click (e.g. 1 month, 3 months, 6 months, 1 year)
  const handleSetPresetDuration = (monthsCount) => {
    let startYear, startMonth;
    if (periodFrom) {
      const parts = periodFrom.split('-').map(Number);
      startYear = parts[0];
      startMonth = parts[1] - 1; // 0-indexed
    } else {
      const now = new Date();
      startYear = now.getFullYear();
      startMonth = now.getMonth();
    }
    
    const fromStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    setPeriodFrom(fromStr);

    // End date is last day of (startMonth + monthsCount)
    const targetEnd = new Date(startYear, startMonth + monthsCount, 0);
    const endYear = targetEnd.getFullYear();
    const endMonth = String(targetEnd.getMonth() + 1).padStart(2, '0');
    const endDay = String(targetEnd.getDate()).padStart(2, '0');
    
    setPeriodTo(`${endYear}-${endMonth}-${endDay}`);
    setPaymentAmount(currentExpectedMonthlyRent * monthsCount);
  };

  // Submit payment
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!pump) return;

    try {
      const receiptNo = `PP-REC-${Date.now().toString().slice(-6)}`;
      const durationLabel = (periodFrom && periodTo)
        ? `${periodFrom} to ${periodTo}`
        : selectedMonthStr;

      const newPayment = {
        petrol_pump_id: pump.id,
        month: durationLabel,
        amount_paid: Number(paymentAmount),
        expected_rent: currentExpectedMonthlyRent,
        fine_amount: 0,
        date: paymentDate,
        receipt_no: receiptNo,
        payment_method: paymentMethod,
        notes: paymentNotes,
        period_from: periodFrom,
        period_to: periodTo
      };

      try {
        await db.petrol_pump_rent_collections.add(newPayment);
      } catch (insertErr) {
        // Fallback gracefully if period_from/to columns haven't been added yet in DB
        if (insertErr.message && (insertErr.message.includes('period_from') || insertErr.message.includes('period_to') || insertErr.code === '42703')) {
          const fallbackPayment = {
            petrol_pump_id: pump.id,
            month: durationLabel,
            amount_paid: Number(paymentAmount),
            expected_rent: currentExpectedMonthlyRent,
            fine_amount: 0,
            date: paymentDate,
            receipt_no: receiptNo,
            payment_method: paymentMethod,
            notes: `Duration: ${periodFrom} to ${periodTo}. ${paymentNotes || ''}`
          };
          await db.petrol_pump_rent_collections.add(fallbackPayment);
        } else {
          throw insertErr;
        }
      }

      setIsPaymentModalOpen(false);

      // Trigger automatic receipt print with enriched duration data
      setPrintData(getEnrichedPaymentData(newPayment));
      setTimeout(() => {
        handlePrint();
      }, 300);
    } catch (err) {
      console.error(err);
      alert('Failed to save payment: ' + err.message);
    }
  };

  // Delete payment (Undo)
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete / undo this rent payment?')) return;
    try {
      await db.petrol_pump_rent_collections.delete(paymentId);
    } catch (err) {
      console.error(err);
      alert('Failed to delete payment: ' + err.message);
    }
  };

  // Print existing receipt
  const handlePrintExistingReceipt = (payment) => {
    setPrintData(getEnrichedPaymentData(payment));
    setTimeout(() => {
      handlePrint();
    }, 200);
  };

  // Handle Edit Petrol Pump
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!pump) return;

    try {
      await db.petrol_pumps.update(pump.id, {
        ...editForm,
        monthly_rent: Number(editForm.monthly_rent) || 0,
        annual_increase_pct: Number(editForm.annual_increase_pct) || 0,
        updated_at: new Date().toISOString()
      });
      setIsEditModalOpen(false);
      alert('Petrol pump updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update petrol pump: ' + err.message);
    }
  };

  // Handle Delete Petrol Pump
  const handleDeletePump = async () => {
    const code = window.prompt(`SAFETY LOCK ACTIVE\n\nTo delete petrol pump "${pump.name}", type 'CONFIRM':`);
    if (code !== 'CONFIRM') {
      if (code !== null) alert("Invalid confirmation code.");
      return;
    }
    try {
      await db.petrol_pumps.delete(pump.id);
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Failed to delete petrol pump: ' + err.message);
    }
  };

  if (!pump) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading petrol pump details...</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Hidden Print Receipt Component */}
      <PetrolPumpReceiptPrint 
        printData={printData}
        innerRef={printRef}
        pump={pump}
        appSettings={appSettings}
      />

      {/* Top Navigation & Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowLeft size={16} /> All Properties
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsEditModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Edit3 size={16} /> Edit Lease Terms
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleDeletePump}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-error)' }}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(245, 158, 11, 0.05))', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Fuel size={32} color="#ef4444" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{pump.name}</h1>
                <span className="badge" style={{ backgroundColor: '#10b981', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                  Active Lease
                </span>
              </div>
              <p style={{ color: 'var(--color-text-muted)', margin: '0.4rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {pump.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {pump.location}</span>}
                {pump.total_area && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>• <Maximize size={14} /> Area: {pump.total_area}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={16} /> Current Monthly Rent
          </p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>
            Rs. {currentExpectedMonthlyRent.toLocaleString()}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Yearly: Rs. {(currentExpectedMonthlyRent * 12).toLocaleString()}</span>
        </div>

        <div className="card">
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <TrendingUp size={16} /> Annual Escalation
          </p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            {pump.annual_increase_pct || 0}%
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Compounds yearly</span>
        </div>

        <div className="card">
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={16} /> Total Lease Period
          </p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            {pump.total_lease_period || 'N/A'}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {pump.lease_start_date ? `From ${pump.lease_start_date}` : ''}
          </span>
        </div>

        <div className="card">
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={16} /> Grace Period
          </p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            {pump.grace_period || 'None'}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Deed Reg: {pump.lease_deed_reg_date || 'N/A'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FileText size={16} /> Lease Agreement Details
        </button>
        <button
          className={`btn ${activeTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('schedule')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <TrendingUp size={16} /> Rent Escalation Schedule
        </button>
        <button
          className={`btn ${activeTab === 'collections' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('collections')}
          style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <DollarSign size={16} /> Rent Collections & Receipts
        </button>
      </div>

      {/* Tab 1: Lease Agreement Details */}
      {activeTab === 'overview' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Full Lease Parameters</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
              <Edit3 size={14} /> Edit
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Site / Property Name</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.name}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Location</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.location || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Area</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.total_area || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Date of Registration of Lease Deed</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.lease_deed_reg_date || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Lease Period</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.total_lease_period || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lease Start Date</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.lease_start_date || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lease End Date</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.lease_end_date || 'N/A'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Grace Period</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.grace_period || 'None'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Base Starting Monthly Rent</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>Rs. {Number(pump.monthly_rent || 0).toLocaleString()}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Annual Increase Rate</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{pump.annual_increase_pct || 0}% per year</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Rent Escalation Schedule */}
      {activeTab === 'schedule' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Year-by-Year Rent Escalation Schedule</h2>
              <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                Automatically calculated compounding at {pump.annual_increase_pct || 0}% annual increase.
              </p>
            </div>
            <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              Current Active Year Highlighted
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Lease Year</th>
                  <th style={{ padding: '0.75rem' }}>Duration Period</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Monthly Rent</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Annual Total Rent</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Increase Rate</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {escalationSchedule.map((item) => (
                  <tr 
                    key={item.yearNumber}
                    style={{ 
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: item.isCurrentYear ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      fontWeight: item.isCurrentYear ? 600 : 'normal'
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <strong>Year {item.yearNumber}</strong>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {item.startDate} to {item.endDate}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      Rs. {item.monthlyRent.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      Rs. {item.annualRent.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {item.yearNumber === 1 ? 'Base' : `+${item.increaseRate}%`}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {item.isCurrentYear ? (
                        <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                          Current Year
                        </span>
                      ) : item.isPastYear ? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Completed</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Upcoming</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rent Collections & Receipts */}
      {activeTab === 'collections' && (
        <div>
          {/* Month Selector & Quick Collect Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Monthly Rent Collection</h2>
                <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                  Track payments, record received rent, and print official receipts.
                </p>
              </div>

              {/* Month Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--color-bg-app)', padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}
                >
                  &laquo; Prev
                </button>
                <span style={{ fontWeight: 600, minWidth: '130px', textAlign: 'center' }}>
                  {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
                >
                  Next &raquo;
                </button>
              </div>
            </div>

            {/* Status for selected month */}
            <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: currentMonthPayment ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {currentMonthPayment ? (
                    <CheckCircle2 size={20} color="#10b981" />
                  ) : (
                    <AlertCircle size={20} color="#ef4444" />
                  )}
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    {currentMonthPayment ? 'Rent Paid' : 'Rent Pending for this Month'}
                  </h3>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Expected Monthly Rent: <strong>Rs. {currentExpectedMonthlyRent.toLocaleString()}</strong>
                  {currentMonthPayment && ` • Paid Rs. ${Number(currentMonthPayment.amount_paid).toLocaleString()} on ${currentMonthPayment.date} (${currentMonthPayment.receipt_no})`}
                </p>
              </div>

              <div>
                {currentMonthPayment ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePrintExistingReceipt(currentMonthPayment)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={16} /> Print Receipt
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeletePayment(currentMonthPayment.id)}
                      style={{ color: 'var(--color-error)' }}
                    >
                      Undo Payment
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleOpenReceive(currentMonthStr)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Plus size={16} /> Receive Rent
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>All Collections & History</h3>
            {pumpCollections.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                No rent collections recorded yet. Click "Receive Rent" above to record a payment.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem' }}>Receipt #</th>
                      <th style={{ padding: '0.75rem' }}>Rent Duration / Period</th>
                      <th style={{ padding: '0.75rem' }}>Payment Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ padding: '0.75rem' }}>Payment Mode</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pumpCollections.map((col) => {
                      const enriched = getEnrichedPaymentData(col);
                      const displayPeriod = (enriched?.period_from && enriched?.period_to)
                        ? `${formatDate(enriched.period_from)} to ${formatDate(enriched.period_to)}`
                        : (col.month || 'N/A');

                      return (
                        <tr key={col.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{col.receipt_no}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                            {displayPeriod}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{formatDate(col.date)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            Rs. {Number(col.amount_paid).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{col.payment_method || 'Bank Transfer'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintExistingReceipt(col)}
                                title="Print Receipt"
                              >
                                <Printer size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDeletePayment(col.id)}
                                style={{ color: 'var(--color-error)' }}
                                title="Delete Record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receive Rent Payment Modal */}
      {isPaymentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Receive Petrol Pump Rent</h2>
              <button className="icon-btn" onClick={() => setIsPaymentModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePayment}>
              {/* Info banner */}
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site</span>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pump.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Rate</span>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)' }}>Rs. {currentExpectedMonthlyRent.toLocaleString()} / mo</div>
                </div>
              </div>

              {/* Quick Preset Duration Buttons */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem', fontWeight: 600 }}>
                  Quick Select Rent Duration:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetPresetDuration(1)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    1 Month
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetPresetDuration(3)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    3 Months
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetPresetDuration(6)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    6 Months
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetPresetDuration(12)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    1 Year
                  </button>
                </div>
              </div>

              {/* Rent Duration Dates From & To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Rent Period From *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rent Period To *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    required 
                  />
                </div>
              </div>

              {/* Payment Date & Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Received (Rs.) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Payment Method</label>
                <select 
                  className="input-field"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online Deposit</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Notes / Transaction Reference (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cheque #12345 or Bank Ref" 
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save & Print Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Petrol Pump Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Petrol Pump Lease Terms</h2>
              <button className="icon-btn" onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Site Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Location *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editForm.location}
                  onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total Area</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.total_area}
                    onChange={e => setEditForm({ ...editForm, total_area: e.target.value })}
                    placeholder="e.g. 4 Kanals" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Reg. of Lease Deed</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editForm.lease_deed_reg_date}
                    onChange={e => setEditForm({ ...editForm, lease_deed_reg_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total Lease Period</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.total_lease_period}
                    onChange={e => setEditForm({ ...editForm, total_lease_period: e.target.value })}
                    placeholder="e.g. 30 Years" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Grace Period</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.grace_period}
                    onChange={e => setEditForm({ ...editForm, grace_period: e.target.value })}
                    placeholder="e.g. 6 Months" 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Lease Start Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editForm.lease_start_date}
                    onChange={e => setEditForm({ ...editForm, lease_start_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lease End Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editForm.lease_end_date}
                    onChange={e => setEditForm({ ...editForm, lease_end_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Starting Monthly Rent (Rs.)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editForm.monthly_rent}
                    onChange={e => setEditForm({ ...editForm, monthly_rent: e.target.value })}
                    placeholder="e.g. 200000" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Annual Increase (%)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editForm.annual_increase_pct}
                    onChange={e => setEditForm({ ...editForm, annual_increase_pct: e.target.value })}
                    placeholder="e.g. 10" 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
