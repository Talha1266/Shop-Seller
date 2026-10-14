import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useDb } from '../hooks/useDb';
import { useSupabase } from '../hooks/useSupabase';
import { 
  Fuel, ArrowLeft, Calendar, MapPin, Maximize, FileText, 
  TrendingUp, DollarSign, CheckCircle2, Clock, Printer, 
  Plus, Trash2, Edit3, X, AlertCircle, Paperclip, Download, Lock
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

// Helper to extract total lease years from period string (e.g. '15 Years', '20', '30 years' -> 15, 20, 30)
export const parseLeaseYears = (period, fallback = 15) => {
  if (typeof period === 'number' && !isNaN(period) && period > 0) return period;
  if (!period) return fallback;
  const match = String(period).match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return fallback;
};

// Helper to calculate lease end date automatically according to start date and total lease period
export const calculateLeaseEndDate = (startDateStr, periodOrYears = 15) => {
  if (!startDateStr) return '';
  const years = typeof periodOrYears === 'number' ? periodOrYears : parseLeaseYears(periodOrYears, 15);
  if (!years || years <= 0) return '';
  try {
    const parts = startDateStr.split('-').map(Number);
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    if (!year || !month || !day) return '';
    
    // End date is exactly `years` full years (day before the anniversary date)
    const end = new Date(year + years, month - 1, day);
    end.setDate(end.getDate() - 1);
    
    const endY = end.getFullYear();
    const endM = String(end.getMonth() + 1).padStart(2, '0');
    const endD = String(end.getDate()).padStart(2, '0');
    return `${endY}-${endM}-${endD}`;
  } catch {
    return '';
  }
};

// Helper to reliably extract rent escalation interval in years (from column or metadata fallback)
export const getPumpIntervalYears = (pump) => {
  if (!pump) return 1;
  if (pump.increase_interval_years && !isNaN(Number(pump.increase_interval_years))) {
    const val = Number(pump.increase_interval_years);
    if (val > 0) return val;
  }
  if (pump.grace_period && pump.grace_period.includes('[Interval:')) {
    const match = pump.grace_period.match(/\[Interval:\s*(\d+)\]/);
    if (match) return Number(match[1]);
  }
  if (pump.total_lease_period && pump.total_lease_period.includes('[Interval:')) {
    const match = pump.total_lease_period.match(/\[Interval:\s*(\d+)\]/);
    if (match) return Number(match[1]);
  }
  return 1;
};

// Helper to reliably extract initial fixed rent duration in years (can be 0)
export const getPumpFixedRentYears = (pump) => {
  if (!pump) return 0;
  if (pump.fixed_rent_years !== undefined && pump.fixed_rent_years !== null && !isNaN(Number(pump.fixed_rent_years))) {
    const val = Number(pump.fixed_rent_years);
    if (val >= 0) return val;
  }
  if (pump.grace_period && pump.grace_period.includes('[FixedYears:')) {
    const match = pump.grace_period.match(/\[FixedYears:\s*(\d+)\]/);
    if (match) return Number(match[1]);
  }
  if (pump.total_lease_period && pump.total_lease_period.includes('[FixedYears:')) {
    const match = pump.total_lease_period.match(/\[FixedYears:\s*(\d+)\]/);
    if (match) return Number(match[1]);
  }
  return 0;
};

// Helper to extract agreement document path from pump record or metadata
export const getPumpAgreementUrl = (pump) => {
  if (!pump) return null;
  if (pump.agreement_url) return pump.agreement_url;
  if (pump.grace_period && pump.grace_period.includes('[Agreement:')) {
    const match = pump.grace_period.match(/\[Agreement:\s*([^\]]+)\]/);
    if (match) return match[1].trim();
  }
  return null;
};

// Helper to strip out internal [Interval: X], [FixedYears: X], and [Agreement: X] metadata from grace_period for clean UI display
export const cleanGracePeriod = (gp) => {
  if (!gp) return '';
  return gp
    .replace(/\[Interval:\s*\d+\]/g, '')
    .replace(/\[FixedYears:\s*\d+\]/g, '')
    .replace(/\[Agreement:\s*[^\]]+\]/g, '')
    .trim();
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
              LEASE RENT RECEIPT
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
          {(printData.payment_method === 'Cheque' || printData.cheque_no) && (
            <>
              {printData.cheque_no && <p style={{ margin: '4px 0' }}><strong>Cheque Number:</strong> {printData.cheque_no}</p>}
              {printData.cheque_date && <p style={{ margin: '4px 0' }}><strong>Cheque Date:</strong> {formatDate(printData.cheque_date)}</p>}
            </>
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
        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
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

// Printable Collections Report for Petrol Pump
const PetrolPumpCollectionsReportPrint = ({
  pump,
  pumpCollections,
  innerRef,
  appSettings,
  getEnrichedPaymentData,
  currentExpectedMonthlyRent
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

  if (!pump) return <div ref={innerRef}></div>;

  const totalCollected = (pumpCollections || []).reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={innerRef} className="print-pump-collections-wrapper" style={{ display: 'none', padding: '24px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; }
          .print-pump-collections-wrapper { display: block !important; }
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
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              POLICE WELFARE PETROL PUMP — LEASE RENT COLLECTIONS REPORT
            </h1>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Site: {pump.name} {pump.location ? `• Location: ${pump.location}` : ''} {pump.total_area ? `• Area: ${pump.total_area}` : ''}
            </h2>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Printed On:</strong> {formattedDate} {formattedTime}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Receipts:</strong> {(pumpCollections || []).length}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Lease Period:</strong> {pump.total_lease_period || '15 Years'}</p>
        </div>
      </div>

      {/* Summary Box */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px', fontSize: '11px' }}>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Total Rent Collected</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#0f766e' }}>
            Rs. {totalCollected.toLocaleString()}
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Current Expected Rent</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>
            Rs. {Number(currentExpectedMonthlyRent || pump.monthly_rent || 0).toLocaleString()} / Mo
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Base Starting Rent</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: 700 }}>
            Rs. {Number(pump.monthly_rent || 0).toLocaleString()} / Mo
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Lease Duration</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
            {pump.lease_start_date ? `${formatDate(pump.lease_start_date)} to ${formatDate(pump.lease_end_date)}` : pump.total_lease_period || '15 Years'}
          </p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: 1.4 }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f172a' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>#</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Receipt #</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Period From</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '110px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Period To</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '100px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Payment Date</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '130px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Amount Paid</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '120px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Payment Mode</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700 }}>Notes / Remarks</th>
          </tr>
        </thead>
        <tbody>
          {(pumpCollections || []).length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                No rent collections recorded yet.
              </td>
            </tr>
          ) : (
            pumpCollections.map((col, idx) => {
              const enriched = getEnrichedPaymentData ? getEnrichedPaymentData(col) : col;
              const fromText = enriched?.period_from ? formatDate(enriched.period_from) : (col.month || '—');
              const toText = enriched?.period_to ? formatDate(enriched.period_to) : (col.month || '—');
              const cleanNotes = (col.notes || '').replace(/\[Attachment:\s*[^\]]+\]/g, '').trim();

              return (
                <tr
                  key={col.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                    {col.receipt_no}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                    {fromText}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                    {toText}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    {formatDate(col.date)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f766e', borderRight: '1px solid #e2e8f0' }}>
                    Rs. {Number(col.amount_paid || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 600 }}>{col.payment_method || 'Bank Transfer'}</span>
                    {enriched?.cheque_no && (
                      <span style={{ display: 'block', fontSize: '9px', color: '#1e40af', marginTop: '2px', fontWeight: 500 }}>
                        #{enriched.cheque_no} {enriched.cheque_date ? `(${formatDate(enriched.cheque_date)})` : ''}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#475569', fontSize: '10.5px' }}>
                    {cleanNotes || '—'}
                  </td>
                </tr>
              );
            })
          )}
          {(pumpCollections || []).length > 0 && (
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700, pageBreakInside: 'avoid' }}>
              <td colSpan="5" style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                GRAND TOTAL AMOUNT COLLECTED ({pumpCollections.length} TRANSACTIONS)
              </td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#0f766e', borderRight: '1px solid #cbd5e1' }}>
                Rs. {totalCollected.toLocaleString()}
              </td>
              <td colSpan="2" style={{ padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '10px' }}>
                POLICE WELFARE LEASE RECORD
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

// Printable Rent Escalation Schedule Report for Petrol Pump
const PetrolPumpScheduleReportPrint = ({
  pump,
  escalationSchedule,
  innerRef,
  appSettings
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

  if (!pump) return <div ref={innerRef}></div>;

  const totalProjected = (escalationSchedule || []).reduce((sum, item) => sum + (item.annualRent || 0), 0);
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={innerRef} className="print-pump-schedule-wrapper" style={{ display: 'none', padding: '24px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: landscape; margin: 10mm; }
          .print-pump-schedule-wrapper { display: block !important; }
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
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              POLICE WELFARE PETROL PUMP — RENT ESCALATION SCHEDULE
            </h1>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Site: {pump.name} {pump.location ? `• Location: ${pump.location}` : ''} {pump.total_area ? `• Area: ${pump.total_area}` : ''}
            </h2>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Printed On:</strong> {formattedDate} {formattedTime}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Total Schedule:</strong> {escalationSchedule.length} Years</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Deed Reg Date:</strong> {pump.lease_deed_reg_date || 'N/A'}</p>
        </div>
      </div>

      {/* Terms Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px', fontSize: '11px' }}>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Base Starting Rent</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: 700 }}>
            Rs. {Number(pump.monthly_rent || 0).toLocaleString()} / Mo
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Fixed Rent Period</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>
            {getPumpFixedRentYears(pump) === 0 ? 'None (0 Years)' : `${getPumpFixedRentYears(pump)} Year${getPumpFixedRentYears(pump) > 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Rent Escalation</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
            +{pump.annual_increase_pct || 0}% every {getPumpIntervalYears(pump)} yr{getPumpIntervalYears(pump) > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Total Projected Value</span>
          <p style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#7c3aed' }}>
            Rs. {totalProjected.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', lineHeight: 1.4 }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f172a' }}>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '80px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Lease Year</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '220px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Duration Period</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', width: '140px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Monthly Rent</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', width: '160px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Annual Total Rent</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '120px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Increase Rate</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px', fontWeight: 700 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {escalationSchedule.map((item, idx) => (
            <tr
              key={item.yearNumber}
              style={{
                backgroundColor: item.isCurrentYear ? '#dcfce7' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                borderBottom: '1px solid #e2e8f0',
                fontWeight: item.isCurrentYear ? 700 : 400
              }}
            >
              <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                Year {item.yearNumber}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                {formatDate(item.startDate)} to {formatDate(item.endDate)}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>
                Rs. {Number(item.monthlyRent || 0).toLocaleString()}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 700, color: '#0f766e' }}>
                Rs. {Number(item.annualRent || 0).toLocaleString()}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                {item.yearNumber === 1 ? (
                  <span style={{ color: '#64748b' }}>Base Rate</span>
                ) : item.isFixedPeriod ? (
                  <span style={{ color: '#64748b', fontSize: '10px' }}>Fixed Period</span>
                ) : item.isEscalationYear ? (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>+{item.increaseRate}% ↑</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Same Rate</span>
                )}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                {item.isCurrentYear ? (
                  <span style={{ backgroundColor: '#16a34a', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 700 }}>
                    CURRENT YEAR
                  </span>
                ) : item.isPastYear ? (
                  <span style={{ color: '#64748b', fontSize: '10px' }}>Completed</span>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>Upcoming</span>
                )}
              </td>
            </tr>
          ))}
          <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700, pageBreakInside: 'avoid' }}>
            <td colSpan="3" style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
              TOTAL PROJECTED LEASE VALUE ({escalationSchedule.length} YEARS)
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f766e', borderRight: '1px solid #cbd5e1', fontSize: '12px' }}>
              Rs. {totalProjected.toLocaleString()}
            </td>
            <td colSpan="2" style={{ padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '10px' }}>
              POLICE WELFARE PETROL PUMP
            </td>
          </tr>
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

// Printable Lease Summary Document for Petrol Pump
const PetrolPumpLeaseSummaryPrint = ({
  pump,
  innerRef,
  appSettings,
  currentExpectedMonthlyRent,
  totalPaidAllTime
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

  if (!pump) return <div ref={innerRef}></div>;

  const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div ref={innerRef} className="print-pump-summary-wrapper" style={{ display: 'none', padding: '30px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <style type="text/css" media="print">
        {`
          @page { size: portrait; margin: 12mm; }
          .print-pump-summary-wrapper { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxHeight: '70px', maxWidth: '100px', objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase' }}>
              POLICE WELFARE PETROL PUMP
            </h1>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              LEASE AGREEMENT & PROPERTY RECORD SUMMARY
            </h2>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
          <p style={{ margin: 0 }}><strong>Date:</strong> {formattedDate}</p>
          <p style={{ margin: '2px 0 0 0' }}><strong>Status:</strong> Active Lease</p>
        </div>
      </div>

      {/* Parameters Grid */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '25px', border: '1px solid #cbd5e1' }}>
        <tbody>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, width: '220px', borderRight: '1px solid #cbd5e1' }}>Site / Property Name</td>
            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{pump.name}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Location</td>
            <td style={{ padding: '8px 12px' }}>{pump.location || 'N/A'}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Total Area</td>
            <td style={{ padding: '8px 12px' }}>{pump.total_area || 'N/A'}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Date of Lease Deed Registration</td>
            <td style={{ padding: '8px 12px' }}>{formatDate(pump.lease_deed_reg_date) || 'N/A'}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Total Lease Period</td>
            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{pump.total_lease_period || '15 Years'}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Lease Start Date</td>
            <td style={{ padding: '8px 12px' }}>{formatDate(pump.lease_start_date) || 'N/A'}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Lease End Date</td>
            <td style={{ padding: '8px 12px' }}>{formatDate(pump.lease_end_date) || 'N/A'}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Grace Period</td>
            <td style={{ padding: '8px 12px' }}>{cleanGracePeriod(pump.grace_period) || 'None'}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Base Starting Monthly Rent</td>
            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f766e' }}>
              Rs. {Number(pump.monthly_rent || 0).toLocaleString()}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Fixed Rent Period</td>
            <td style={{ padding: '8px 12px' }}>
              {getPumpFixedRentYears(pump) === 0 ? 'None (0 Years - Regular Escalation)' : `${getPumpFixedRentYears(pump)} Year(s) (No Increase)`}
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Rent Escalation Terms</td>
            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
              +{pump.annual_increase_pct || 0}% every {getPumpIntervalYears(pump)} year(s)
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Current Expected Monthly Rent</td>
            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>
              Rs. {Number(currentExpectedMonthlyRent || 0).toLocaleString()} / Month
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Total Rent Collected To Date</td>
            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f766e' }}>
              Rs. {Number(totalPaidAllTime || 0).toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>Compulsory Lease Agreement</td>
            <td style={{ padding: '8px 12px' }}>
              {getPumpAgreementUrl(pump) ? 'Attached and Verified on File' : 'Missing / Pending Attachment'}
            </td>
          </tr>
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

export default function PetrolPumpDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDb();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'schedule', 'collections'
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editPeriodFrom, setEditPeriodFrom] = useState('');
  const [editPeriodTo, setEditPeriodTo] = useState('');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Bank Transfer');
  const [editChequeNo, setEditChequeNo] = useState('');
  const [editChequeDate, setEditChequeDate] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [editAttachmentFile, setEditAttachmentFile] = useState(null);
  const [editAttachmentPreview, setEditAttachmentPreview] = useState(null);
  const [isUploadingEditAttachment, setIsUploadingEditAttachment] = useState(false);
  const [keepExistingAttachment, setKeepExistingAttachment] = useState(true);
  const [selectedMonthStr, setSelectedMonthStr] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [printData, setPrintData] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState(null);
  const [viewingAttachmentTitle, setViewingAttachmentTitle] = useState('');

  // Helper to extract attachment path from payment
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
      setViewingAttachmentTitle(`Attachment - Receipt #${payment.receipt_no} (${payment.payment_method})`);
    } catch (err) {
      console.error(err);
      alert('Failed to load attachment: ' + err.message);
    }
  };

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

  const totalPaidAllTime = useMemo(() => {
    return pumpCollections.reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);
  }, [pumpCollections]);

  // App settings for receipt branding
  const appSettingsList = useSupabase('app_settings') || [];
  const appSettings = appSettingsList.length > 0 ? appSettingsList[0] : null;

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const printCollectionsRef = useRef(null);
  const handlePrintCollections = useReactToPrint({
    contentRef: printCollectionsRef,
    documentTitle: `${pump?.name || 'PetrolPump'}_Rent_Collections_Report`,
  });

  const printScheduleRef = useRef(null);
  const handlePrintSchedule = useReactToPrint({
    contentRef: printScheduleRef,
    documentTitle: `${pump?.name || 'PetrolPump'}_Escalation_Schedule`,
  });

  const printLeaseSummaryRef = useRef(null);
  const handlePrintLeaseSummary = useReactToPrint({
    contentRef: printLeaseSummaryRef,
    documentTitle: `${pump?.name || 'PetrolPump'}_Lease_Summary`,
  });

  // Edit form state
  const [editAgreementFile, setEditAgreementFile] = useState(null);
  const [isUploadingAgreement, setIsUploadingAgreement] = useState(false);

  // Helper to open the lease agreement in viewer
  const handleOpenAgreementDoc = async (pumpObj) => {
    const p = pumpObj || pump;
    const path = getPumpAgreementUrl(p);
    if (!path) {
      alert("No lease agreement document found for this petrol pump.");
      return;
    }

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
      setViewingAttachmentTitle(`Lease Agreement - ${p.name}`);
    } catch (err) {
      console.error(err);
      alert('Failed to load lease agreement document: ' + err.message);
    }
  };

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
    fixed_rent_years: '0',
    annual_increase_pct: '',
    increase_interval_years: '1'
  });

  useEffect(() => {
    if (pump) {
      setEditForm({
        name: pump.name || '',
        location: pump.location || '',
        total_area: pump.total_area || '',
        lease_deed_reg_date: pump.lease_deed_reg_date || '',
        total_lease_period: pump.total_lease_period || '15 Years',
        lease_start_date: pump.lease_start_date || '',
        lease_end_date: pump.lease_end_date || (pump.lease_start_date ? calculateLeaseEndDate(pump.lease_start_date, pump.total_lease_period || 15) : ''),
        grace_period: cleanGracePeriod(pump.grace_period),
        monthly_rent: pump.monthly_rent || '',
        fixed_rent_years: getPumpFixedRentYears(pump),
        annual_increase_pct: pump.annual_increase_pct || '',
        increase_interval_years: getPumpIntervalYears(pump)
      });
    }
  }, [pump]);

  // Calculate year-by-year escalation schedule based on fixed rent years and increase frequency
  const escalationSchedule = useMemo(() => {
    if (!pump) return [];
    
    const baseRent = Number(pump.monthly_rent) || 0;
    const increasePct = Number(pump.annual_increase_pct) || 0;
    const intervalYears = getPumpIntervalYears(pump);
    const fixedYears = getPumpFixedRentYears(pump);
    const startDate = pump.lease_start_date ? new Date(pump.lease_start_date) : new Date();
    
    // Determine total years (from total_lease_period or date difference)
    let totalYears = parseLeaseYears(pump.total_lease_period, 15);
    if (!pump.total_lease_period && pump.lease_end_date && pump.lease_start_date) {
      const diffYears = (new Date(pump.lease_end_date) - new Date(pump.lease_start_date)) / (365.25 * 24 * 3600 * 1000);
      if (diffYears > 0) totalYears = Math.round(diffYears);
    }

    if (totalYears <= 0 || totalYears > 99) totalYears = 15;

    const today = new Date();
    const schedule = [];

    for (let y = 1; y <= totalYears; y++) {
      const yearStart = new Date(startDate);
      yearStart.setFullYear(startDate.getFullYear() + (y - 1));

      const yearEnd = new Date(startDate);
      yearEnd.setFullYear(startDate.getFullYear() + y);
      yearEnd.setDate(yearEnd.getDate() - 1);

      let monthlyRent = baseRent;
      let isEscalationYear = false;
      let increaseRate = 0;
      let isFixedPeriod = false;

      const effectiveFixed = fixedYears > 0 ? fixedYears : intervalYears;

      if (y <= effectiveFixed) {
        // Initial fixed / base rent period
        monthlyRent = baseRent;
        isEscalationYear = false;
        increaseRate = 0;
        isFixedPeriod = true;
      } else {
        // Post fixed rent period: increases every intervalYears
        const yearsAfterFixed = y - effectiveFixed;
        const escalationSteps = 1 + Math.floor((yearsAfterFixed - 1) / intervalYears);
        monthlyRent = Math.round(baseRent * Math.pow(1 + (increasePct / 100), escalationSteps));
        isEscalationYear = (yearsAfterFixed - 1) % intervalYears === 0;
        increaseRate = isEscalationYear ? increasePct : 0;
        isFixedPeriod = false;
      }

      const annualRent = monthlyRent * 12;
      const isCurrentYear = today >= yearStart && today <= yearEnd;
      const isPastYear = today > yearEnd;

      schedule.push({
        yearNumber: y,
        startDate: yearStart.toISOString().split('T')[0],
        endDate: yearEnd.toISOString().split('T')[0],
        monthlyRent,
        annualRent,
        increaseRate,
        isEscalationYear,
        isFixedPeriod,
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

    let chqNo = payment.cheque_no || payment.chequeNo || null;
    let chqDate = payment.cheque_date || payment.chequeDate || null;
    if (!chqNo && payment.notes) {
      const match = payment.notes.match(/Cheque\s*(?:#|No|Number)?:\s*([^,\]]+)/i);
      if (match) chqNo = match[1].trim();
    }
    if (!chqDate && payment.notes) {
      const match = payment.notes.match(/Cheque\s*Date:\s*([^,\]]+)/i) || payment.notes.match(/Date:\s*([^,\]]+)/i);
      if (match) chqDate = match[1].trim();
    }

    return {
      ...payment,
      period_from: from,
      period_to: to,
      cheque_no: chqNo,
      cheque_date: chqDate
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
    setPaymentMethod('Bank Transfer');
    setChequeNo('');
    setChequeDate('');
    setPaymentNotes('');
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setIsUploadingAttachment(false);
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

    try {
      let uploadedPath = null;
      if (attachmentFile) {
        setIsUploadingAttachment(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const cleanFileName = `cheque_${pump.id}_${Date.now()}.${fileExt}`;
        const filePath = `petrol_pumps/cheques/${cleanFileName}`;

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

      const receiptNo = `PP-REC-${Date.now().toString().slice(-6)}`;
      const durationLabel = (periodFrom && periodTo)
        ? `${periodFrom} to ${periodTo}`
        : selectedMonthStr;

      const chequeNotes = paymentMethod === 'Cheque' ? `[Cheque #: ${chequeNo.trim()}, Date: ${chequeDate}]` : '';
      const combinedNotes = [
        chequeNotes,
        uploadedPath ? `[Attachment: ${uploadedPath}]` : '',
        paymentNotes ? paymentNotes.trim() : ''
      ].filter(Boolean).join(' ');

      const newPayment = {
        petrol_pump_id: pump.id,
        month: durationLabel,
        amount_paid: Number(paymentAmount),
        expected_rent: currentExpectedMonthlyRent,
        fine_amount: 0,
        date: paymentDate,
        receipt_no: receiptNo,
        payment_method: paymentMethod,
        cheque_no: paymentMethod === 'Cheque' ? chequeNo.trim() : null,
        cheque_date: paymentMethod === 'Cheque' ? chequeDate : null,
        notes: combinedNotes,
        period_from: periodFrom,
        period_to: periodTo,
        attachment_url: uploadedPath
      };

      try {
        await db.petrol_pump_rent_collections.add(newPayment);
      } catch (insertErr) {
        // Fallback gracefully if attachment_url, period_from/to, or cheque columns haven't been added yet in DB
        if (insertErr.message && (
          insertErr.message.includes('attachment_url') || 
          insertErr.message.includes('period_from') || 
          insertErr.message.includes('period_to') || 
          insertErr.message.includes('cheque_no') || 
          insertErr.message.includes('cheque_date') || 
          insertErr.code === '42703'
        )) {
          const fallbackPayment = {
            petrol_pump_id: pump.id,
            month: durationLabel,
            amount_paid: Number(paymentAmount),
            expected_rent: currentExpectedMonthlyRent,
            fine_amount: 0,
            date: paymentDate,
            receipt_no: receiptNo,
            payment_method: paymentMethod,
            notes: `${combinedNotes} Duration: ${periodFrom} to ${periodTo}.`.trim()
          };
          await db.petrol_pump_rent_collections.add(fallbackPayment);
        } else {
          throw insertErr;
        }
      }

      setAttachmentFile(null);
      setAttachmentPreview(null);
      setChequeNo('');
      setChequeDate('');

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

  // Handle open edit payment modal
  const handleOpenEditPayment = (payment) => {
    if (!payment) return;
    const enriched = getEnrichedPaymentData(payment);
    setEditingPayment(enriched);
    setEditPaymentDate(enriched.date ? new Date(enriched.date).toISOString().split('T')[0] : '');
    setEditPeriodFrom(enriched.period_from || '');
    setEditPeriodTo(enriched.period_to || '');
    setEditPaymentAmount(enriched.amount_paid || '');
    setEditPaymentMethod(enriched.payment_method || 'Bank Transfer');
    setEditChequeNo(enriched.cheque_no || '');
    setEditChequeDate(enriched.cheque_date || '');
    
    // Clean notes (remove attachment tag, cheque tag, and duration tag)
    let userNotes = enriched.notes || '';
    userNotes = userNotes.replace(/\[Attachment:\s*[^\]]+\]/g, '');
    userNotes = userNotes.replace(/\[Cheque\s*(?:#|No|Number)?:\s*[^,\]]+,\s*Date:\s*[^\]]+\]/gi, '');
    userNotes = userNotes.replace(/Duration:\s*\S+\s*to\s*\S+\.?/gi, '');
    setEditPaymentNotes(userNotes.trim());
    
    setEditAttachmentFile(null);
    setEditAttachmentPreview(null);
    setIsUploadingEditAttachment(false);
    setKeepExistingAttachment(true);
    setIsEditPaymentModalOpen(true);
  };

  // Preset duration buttons for Edit Payment Modal
  const handleSetEditPresetDuration = (monthsCount) => {
    let startYear, startMonth;
    if (editPeriodFrom) {
      const parts = editPeriodFrom.split('-').map(Number);
      startYear = parts[0];
      startMonth = parts[1] - 1;
    } else {
      const now = new Date();
      startYear = now.getFullYear();
      startMonth = now.getMonth();
    }
    
    const fromStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    setEditPeriodFrom(fromStr);

    const targetEnd = new Date(startYear, startMonth + monthsCount, 0);
    const endYear = targetEnd.getFullYear();
    const endMonth = String(targetEnd.getMonth() + 1).padStart(2, '0');
    const endDay = String(targetEnd.getDate()).padStart(2, '0');
    
    setEditPeriodTo(`${endYear}-${endMonth}-${endDay}`);
    setEditPaymentAmount(currentExpectedMonthlyRent * monthsCount);
  };

  // Handle edit attachment change
  const handleEditAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit. Please choose a smaller file.');
        e.target.value = '';
        return;
      }
      setEditAttachmentFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditAttachmentPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setEditAttachmentPreview(null);
      }
    }
  };

  // Submit edit payment
  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!editingPayment || !pump) return;

    if (editPaymentMethod === 'Cheque') {
      if (!editChequeNo || !editChequeNo.trim()) {
        alert('Cheque Number is compulsory for Cheque payments.');
        return;
      }
      if (!editChequeDate) {
        alert('Cheque Date is compulsory for Cheque payments.');
        return;
      }
    }

    try {
      let finalAttachmentPath = keepExistingAttachment ? getAttachmentPath(editingPayment) : null;
      
      if (editAttachmentFile) {
        setIsUploadingEditAttachment(true);
        const fileExt = editAttachmentFile.name.split('.').pop();
        const cleanFileName = `cheque_${pump.id}_${Date.now()}.${fileExt}`;
        const filePath = `petrol_pumps/cheques/${cleanFileName}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('tenant-documents')
            .upload(filePath, editAttachmentFile, { upsert: true });

          if (!uploadError) {
            finalAttachmentPath = filePath;
          } else {
            console.warn('Storage upload error, continuing:', uploadError);
          }
        } catch (uploadErr) {
          console.warn('Failed to upload file to storage:', uploadErr);
        } finally {
          setIsUploadingEditAttachment(false);
        }
      }

      const durationLabel = (editPeriodFrom && editPeriodTo)
        ? `${editPeriodFrom} to ${editPeriodTo}`
        : editingPayment.month;

      const chequeNotes = editPaymentMethod === 'Cheque' ? `[Cheque #: ${editChequeNo.trim()}, Date: ${editChequeDate}]` : '';
      const combinedNotes = [
        chequeNotes,
        finalAttachmentPath ? `[Attachment: ${finalAttachmentPath}]` : '',
        editPaymentNotes ? editPaymentNotes.trim() : ''
      ].filter(Boolean).join(' ');

      const updates = {
        month: durationLabel,
        amount_paid: Number(editPaymentAmount),
        date: editPaymentDate,
        payment_method: editPaymentMethod,
        cheque_no: editPaymentMethod === 'Cheque' ? editChequeNo.trim() : null,
        cheque_date: editPaymentMethod === 'Cheque' ? editChequeDate : null,
        notes: combinedNotes,
        period_from: editPeriodFrom,
        period_to: editPeriodTo,
        attachment_url: finalAttachmentPath
      };

      try {
        await db.petrol_pump_rent_collections.update(editingPayment.id, updates);
      } catch (updateErr) {
        // Fallback if schema doesn't have certain columns
        if (updateErr.message && (
          updateErr.message.includes('attachment_url') || 
          updateErr.message.includes('period_from') || 
          updateErr.message.includes('period_to') || 
          updateErr.message.includes('cheque_no') || 
          updateErr.message.includes('cheque_date') || 
          updateErr.code === '42703'
        )) {
          const fallbackUpdates = {
            month: durationLabel,
            amount_paid: Number(editPaymentAmount),
            date: editPaymentDate,
            payment_method: editPaymentMethod,
            notes: `${combinedNotes} Duration: ${editPeriodFrom} to ${editPeriodTo}.`.trim()
          };
          await db.petrol_pump_rent_collections.update(editingPayment.id, fallbackUpdates);
        } else {
          throw updateErr;
        }
      }

      setIsEditPaymentModalOpen(false);
      setEditingPayment(null);
      setEditAttachmentFile(null);
      setEditAttachmentPreview(null);
      alert('Rent payment record updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update payment: ' + err.message);
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

    if (!getPumpAgreementUrl(pump) && !editAgreementFile) {
      alert("Lease agreement document is compulsory for every petrol pump lease. Please attach the document.");
      return;
    }

    const targetIntervalYears = Math.max(1, Number(editForm.increase_interval_years) || 1);
    const parsedFixed = Number(editForm.fixed_rent_years);
    const targetFixedYears = isNaN(parsedFixed) || parsedFixed < 0 ? 0 : Math.floor(parsedFixed);
    const rawGracePeriod = cleanGracePeriod(editForm.grace_period);

    let newAgreementPath = null;
    if (editAgreementFile) {
      setIsUploadingAgreement(true);
      try {
        const cleanFileName = editAgreementFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `petrol_pumps/agreements/${Date.now()}_${cleanFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(filePath, editAgreementFile, { upsert: true });

        if (uploadError) throw uploadError;
        newAgreementPath = filePath;
      } catch (uploadErr) {
        setIsUploadingAgreement(false);
        console.error(uploadErr);
        alert('Failed to upload agreement file: ' + uploadErr.message);
        return;
      } finally {
        setIsUploadingAgreement(false);
      }
    }

    const finalAgreementUrl = newAgreementPath || getPumpAgreementUrl(pump);

    const updateData = {
      name: editForm.name?.trim(),
      location: editForm.location?.trim() || null,
      total_area: editForm.total_area?.trim() || null,
      lease_deed_reg_date: editForm.lease_deed_reg_date ? editForm.lease_deed_reg_date : null,
      total_lease_period: editForm.total_lease_period?.trim() || null,
      lease_start_date: editForm.lease_start_date ? editForm.lease_start_date : null,
      lease_end_date: editForm.lease_end_date ? editForm.lease_end_date : null,
      grace_period: rawGracePeriod || null,
      monthly_rent: Number(editForm.monthly_rent) || 0,
      fixed_rent_years: targetFixedYears,
      annual_increase_pct: Number(editForm.annual_increase_pct) || 0,
      increase_interval_years: targetIntervalYears,
      agreement_url: finalAgreementUrl,
      updated_at: new Date().toISOString()
    };

    try {
      try {
        await db.petrol_pumps.update(pump.id, updateData);
      } catch (updErr) {
        if (updErr.message && (
          updErr.message.includes('fixed_rent_years') || 
          updErr.message.includes('increase_interval_years') || 
          updErr.message.includes('agreement_url') || 
          updErr.code === '42703'
        )) {
          // If the column does not exist in DB yet, preserve in metadata so they are never lost!
          const metaString = `[FixedYears: ${targetFixedYears}] [Interval: ${targetIntervalYears}]${finalAgreementUrl ? ` [Agreement: ${finalAgreementUrl}]` : ''}`;
          const fallbackGrace = rawGracePeriod 
            ? `${rawGracePeriod} ${metaString}` 
            : metaString;
          const fallbackData = { 
            ...updateData,
            grace_period: fallbackGrace
          };
          delete fallbackData.fixed_rent_years;
          delete fallbackData.increase_interval_years;
          delete fallbackData.agreement_url;
          await db.petrol_pumps.update(pump.id, fallbackData);
        } else {
          throw updErr;
        }
      }
      setEditAgreementFile(null);
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

      {/* Hidden Print Report Components */}
      <PetrolPumpCollectionsReportPrint
        pump={pump}
        pumpCollections={pumpCollections}
        innerRef={printCollectionsRef}
        appSettings={appSettings}
        getEnrichedPaymentData={getEnrichedPaymentData}
        currentExpectedMonthlyRent={currentExpectedMonthlyRent}
      />

      <PetrolPumpScheduleReportPrint
        pump={pump}
        escalationSchedule={escalationSchedule}
        innerRef={printScheduleRef}
        appSettings={appSettings}
      />

      <PetrolPumpLeaseSummaryPrint
        pump={pump}
        innerRef={printLeaseSummaryRef}
        appSettings={appSettings}
        currentExpectedMonthlyRent={currentExpectedMonthlyRent}
        totalPaidAllTime={totalPaidAllTime}
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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrintCollections}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
            title="Print Full Rent Collections Ledger Report"
          >
            <Printer size={16} /> Print Collections Report
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrintSchedule}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
            title="Print Year-by-Year Escalation Schedule Report"
          >
            <Printer size={16} /> Print Escalation Schedule
          </button>
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
            <TrendingUp size={16} /> Rent Escalation
          </p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            +{pump.annual_increase_pct || 0}%
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Fixed {getPumpFixedRentYears(pump)} yr{getPumpFixedRentYears(pump) > 1 ? 's' : ''}, then every {getPumpIntervalYears(pump)} yr{getPumpIntervalYears(pump) > 1 ? 's' : ''}
          </span>
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
            {cleanGracePeriod(pump.grace_period) || 'None'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Full Lease Parameters</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handlePrintLeaseSummary}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
                title="Print Full Lease Parameters & Agreement Summary"
              >
                <Printer size={14} /> Print Lease Summary
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
                <Edit3 size={14} /> Edit
              </button>
            </div>
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
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{cleanGracePeriod(pump.grace_period) || 'None'}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Base Starting Monthly Rent</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>Rs. {Number(pump.monthly_rent || 0).toLocaleString()}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Fixed Rent Period</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>
                {getPumpFixedRentYears(pump) === 0 
                  ? 'None (0 Years - Regular Escalation)' 
                  : `First ${getPumpFixedRentYears(pump)} year${getPumpFixedRentYears(pump) > 1 ? 's' : ''} (no increase)`}
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Rent Increase Terms</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.25rem 0 0 0' }}>
                +{pump.annual_increase_pct || 0}% every {getPumpIntervalYears(pump)} year{getPumpIntervalYears(pump) > 1 ? 's' : ''} 
                {getPumpFixedRentYears(pump) > 0 ? ` (starts Year ${getPumpFixedRentYears(pump) + 1})` : ` (starts Year ${getPumpIntervalYears(pump) + 1})`}
              </p>
            </div>
          </div>

          {/* Attached Lease Agreement Section */}
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <FileText size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Compulsory Lease Agreement</h4>
                  {getPumpAgreementUrl(pump) ? (
                    <span className="badge" style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>
                      Attached
                    </span>
                  ) : (
                    <span className="badge" style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>
                      Missing
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {getPumpAgreementUrl(pump) 
                    ? `Document: ${getPumpAgreementUrl(pump).split('/').pop()}` 
                    : 'Lease agreement document must be attached for this petrol pump.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {getPumpAgreementUrl(pump) ? (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => handleOpenAgreementDoc(pump)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FileText size={15} /> View Agreement
                </button>
              ) : (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => setIsEditModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                >
                  <Paperclip size={15} /> Attach Agreement Now
                </button>
              )}
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
                {getPumpFixedRentYears(pump) === 0
                  ? `Rent escalates by +${pump.annual_increase_pct || 0}% every ${getPumpIntervalYears(pump)} year${getPumpIntervalYears(pump) > 1 ? 's' : ''} as specified in the lease deed.`
                  : `Rent is fixed for the first ${getPumpFixedRentYears(pump)} year${getPumpFixedRentYears(pump) > 1 ? 's' : ''}, then escalates by +${pump.annual_increase_pct || 0}% every ${getPumpIntervalYears(pump)} year${getPumpIntervalYears(pump) > 1 ? 's' : ''} as specified in the lease deed.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handlePrintSchedule}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
                title="Print Year-by-Year Escalation Schedule Report"
              >
                <Printer size={16} /> Print Escalation Schedule
              </button>
              <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                Current Active Year Highlighted
              </span>
            </div>
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
                      {item.yearNumber === 1 ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {getPumpFixedRentYears(pump) === 0 ? 'Base Rate' : 'Base Rate (Fixed)'}
                        </span>
                      ) : item.isFixedPeriod ? (
                        <span style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-app)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {getPumpFixedRentYears(pump) === 0 ? 'Base Period' : 'Fixed Period'}
                        </span>
                      ) : item.isEscalationYear ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>+{item.increaseRate}% ↑</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Same Rate</span>
                      )}
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditPayment(currentMonthPayment)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#d97706', borderColor: '#fef3c7', backgroundColor: '#fffbeb' }}
                      title="Edit Payment"
                    >
                      <Edit3 size={15} /> Edit Payment
                    </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>All Collections & History</h3>
              {pumpCollections.length > 0 && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handlePrintCollections}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', color: 'var(--color-primary)', borderColor: '#bfdbfe', fontWeight: 600 }}
                  title="Print Full Rent Collections Ledger Report"
                >
                  <Printer size={16} /> Print Collections Report
                </button>
              )}
            </div>
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
                      <th style={{ padding: '0.75rem' }}>From Date</th>
                      <th style={{ padding: '0.75rem' }}>To Date</th>
                      <th style={{ padding: '0.75rem' }}>Payment Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ padding: '0.75rem' }}>Payment Mode</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pumpCollections.map((col) => {
                      const enriched = getEnrichedPaymentData(col);
                      const fromText = enriched?.period_from ? formatDate(enriched.period_from) : (col.month || '—');
                      const toText = enriched?.period_to ? formatDate(enriched.period_to) : (col.month || '—');

                      return (
                        <tr key={col.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{col.receipt_no}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                            {fromText}
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                            {toText}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{formatDate(col.date)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            Rs. {Number(col.amount_paid).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span>{col.payment_method || 'Bank Transfer'}</span>
                              {enriched?.cheque_no && (
                                <span style={{ fontSize: '0.72rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                  #{enriched.cheque_no}
                                </span>
                              )}
                              {getAttachmentPath(col) && (
                                <button 
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleOpenAttachmentViewer(col)}
                                  style={{ 
                                    padding: '0.2rem 0.5rem', 
                                    fontSize: '0.75rem', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.3rem', 
                                    color: 'var(--color-primary)', 
                                    borderColor: 'var(--color-primary)',
                                    backgroundColor: 'rgba(59, 130, 246, 0.05)'
                                  }}
                                  title="View Attached Picture of Cheque / Receipt"
                                >
                                  <Paperclip size={12} /> View Cheque
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditPayment(col)}
                                style={{ color: '#d97706' }}
                                title="Edit Rent Payment Record"
                              >
                                <Edit3 size={14} />
                              </button>
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
                  <label className="form-label">From Date (Rent Period Start) *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date (Rent Period End) *</label>
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
                      className="input-field" 
                      required 
                      value={chequeNo} 
                      onChange={e => setChequeNo(e.target.value)} 
                      placeholder="e.g. CHQ-556677" 
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
                      className="input-field" 
                      required 
                      value={chequeDate} 
                      onChange={e => setChequeDate(e.target.value)} 
                      style={{ borderColor: '#93c5fd', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              {/* Optional Cheque / Receipt Picture Attachment */}
              {(paymentMethod === 'Cheque' || paymentMethod === 'Online' || paymentMethod === 'Bank Transfer') && (
                <div style={{ 
                  marginBottom: '1.25rem', 
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
                    className="input-field" 
                    onChange={handleAttachmentChange}
                    style={{ fontSize: '0.85rem' }} 
                  />
                  {attachmentPreview && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img 
                        src={attachmentPreview} 
                        alt="Cheque Preview" 
                        style={{ maxHeight: '80px', maxWidth: '140px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }} 
                      />
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <button type="submit" className="btn btn-primary" disabled={isUploadingAttachment}>
                  {isUploadingAttachment ? 'Uploading Photo...' : 'Save & Print Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Petrol Pump Rent Payment Modal */}
      {isEditPaymentModalOpen && editingPayment && (
        <div className="modal-overlay" onClick={() => setIsEditPaymentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} /> Edit Petrol Pump Rent Payment
              </h2>
              <button className="icon-btn" onClick={() => setIsEditPaymentModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdatePayment}>
              {/* Info banner */}
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Receipt #</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{editingPayment.receipt_no}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site</span>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)' }}>{pump.name}</div>
                </div>
              </div>

              {/* Quick Preset Duration Buttons */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem', fontWeight: 600 }}>
                  Adjust Rent Duration Preset:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetEditPresetDuration(1)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    1 Month
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetEditPresetDuration(3)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    3 Months
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetEditPresetDuration(6)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    6 Months
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetEditPresetDuration(12)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.2rem', textAlign: 'center' }}
                  >
                    1 Year
                  </button>
                </div>
              </div>

              {/* Duration From & To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Period From</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editPeriodFrom}
                    onChange={(e) => setEditPeriodFrom(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Period To</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editPeriodTo}
                    onChange={(e) => setEditPeriodTo(e.target.value)}
                    required 
                  />
                </div>
              </div>

              {/* Payment Date & Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount Paid (Rs.)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    required 
                    min="1"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Payment Method</label>
                <select 
                  className="input-field"
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online Deposit</option>
                </select>
              </div>

              {/* Compulsory Cheque Fields if Cheque */}
              {editPaymentMethod === 'Cheque' && (
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
                      className="input-field" 
                      required 
                      value={editChequeNo} 
                      onChange={e => setEditChequeNo(e.target.value)} 
                      placeholder="e.g. CHQ-556677" 
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
                      className="input-field" 
                      required 
                      value={editChequeDate} 
                      onChange={e => setEditChequeDate(e.target.value)} 
                      style={{ borderColor: '#93c5fd', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              {/* Picture Attachment section */}
              {(editPaymentMethod === 'Cheque' || editPaymentMethod === 'Online' || editPaymentMethod === 'Bank Transfer') && (
                <div style={{ 
                  marginBottom: '1.25rem', 
                  padding: '0.85rem', 
                  borderRadius: '8px', 
                  border: '1px dashed var(--color-primary)', 
                  backgroundColor: 'rgba(59, 130, 246, 0.04)' 
                }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Paperclip size={16} color="var(--color-primary)" />
                      {editPaymentMethod === 'Cheque' ? 'Picture of Cheque' : 'Picture of Receipt / Slip'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>JPG, PNG up to 10MB</span>
                  </label>

                  {/* Show existing attachment if present */}
                  {keepExistingAttachment && getAttachmentPath(editingPayment) && !editAttachmentFile && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem' }}>
                        <Paperclip size={14} color="var(--color-primary)" />
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Existing Attached Document</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenAttachmentViewer(editingPayment)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setKeepExistingAttachment(false)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    className="input-field" 
                    onChange={handleEditAttachmentChange}
                    style={{ fontSize: '0.85rem' }} 
                  />
                  {editAttachmentPreview && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img 
                        src={editAttachmentPreview} 
                        alt="New Cheque Preview" 
                        style={{ maxHeight: '80px', maxWidth: '140px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }} 
                      />
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {editAttachmentFile?.name}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => { setEditAttachmentFile(null); setEditAttachmentPreview(null); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                        >
                          Cancel new file
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes / Transaction Reference */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Notes / Transaction Reference (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editPaymentNotes}
                  onChange={(e) => setEditPaymentNotes(e.target.value)}
                  placeholder="e.g. Cheque #12345 or Bank Ref" 
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isUploadingEditAttachment}>
                  {isUploadingEditAttachment ? 'Uploading Photo...' : 'Save Changes'}
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
              <button className="icon-btn" onClick={() => setViewingAttachmentUrl(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
              {viewingAttachmentUrl && viewingAttachmentUrl.toLowerCase().includes('.pdf') ? (
                <iframe 
                  src={viewingAttachmentUrl} 
                  title="Document Viewer" 
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '6px' }}
                />
              ) : (
                <img 
                  src={viewingAttachmentUrl} 
                  alt="Attachment Preview" 
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                />
              )}
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
                    onChange={e => {
                      const newPeriod = e.target.value;
                      const newEndDate = editForm.lease_start_date 
                        ? calculateLeaseEndDate(editForm.lease_start_date, newPeriod) 
                        : editForm.lease_end_date;
                      setEditForm({ 
                        ...editForm, 
                        total_lease_period: newPeriod,
                        lease_end_date: newEndDate
                      });
                    }}
                    placeholder="e.g. 15 Years" 
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
                    onChange={e => {
                      const startDate = e.target.value;
                      const autoEndDate = calculateLeaseEndDate(startDate, editForm.total_lease_period);
                      setEditForm({ 
                        ...editForm, 
                        lease_start_date: startDate,
                        lease_end_date: autoEndDate
                      });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Lease End Date</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Lock size={12} /> Auto ({parseLeaseYears(editForm.total_lease_period)} Yrs Locked)
                    </span>
                  </label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editForm.lease_end_date}
                    readOnly
                    disabled
                    style={{ 
                      backgroundColor: 'var(--color-bg-secondary, #f1f5f9)', 
                      cursor: 'not-allowed',
                      opacity: 0.85
                    }}
                    title={`Lease end date is locked and automatically calculated for ${parseLeaseYears(editForm.total_lease_period)} years from Lease Start Date`}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
                  <label className="form-label">Rent Fixed For (Years)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    min="0"
                    step="1"
                    value={editForm.fixed_rent_years}
                    onChange={e => setEditForm({ ...editForm, fixed_rent_years: e.target.value })}
                    placeholder="e.g. 0 (none) or 3" 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Increase Rate (%)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editForm.annual_increase_pct}
                    onChange={e => setEditForm({ ...editForm, annual_increase_pct: e.target.value })}
                    placeholder="e.g. 10" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subsequent Increase Every (Years)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    min="1"
                    step="1"
                    value={editForm.increase_interval_years}
                    onChange={e => setEditForm({ ...editForm, increase_interval_years: e.target.value })}
                    placeholder="e.g. 3" 
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 1.5rem 0' }}>
                {Number(editForm.fixed_rent_years) === 0
                  ? `No fixed rent period. Rent will increase by ${editForm.annual_increase_pct || 0}% every ${editForm.increase_interval_years || 1} year${Number(editForm.increase_interval_years || 1) > 1 ? 's' : ''}.`
                  : `Rent will remain fixed for the first ${editForm.fixed_rent_years} year${Number(editForm.fixed_rent_years) > 1 ? 's' : ''}, and then increase by ${editForm.annual_increase_pct || 0}% every ${editForm.increase_interval_years || 1} year${Number(editForm.increase_interval_years || 1) > 1 ? 's' : ''}.`}
              </p>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    Lease Agreement Document {getPumpAgreementUrl(pump) ? '(Replace Attached File)' : <span style={{ color: '#ef4444' }}>* (Compulsory)</span>}
                  </span>
                  {getPumpAgreementUrl(pump) && (
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Document Attached</span>
                  )}
                </label>
                <input 
                  type="file" 
                  accept=".pdf,image/*,.doc,.docx"
                  className="input-field" 
                  onChange={e => {
                    const file = e.target.files[0];
                    setEditAgreementFile(file || null);
                  }}
                />
                {editAgreementFile ? (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.825rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Paperclip size={14} /> Selected: {editAgreementFile.name} ({(editAgreementFile.size / 1024).toFixed(1)} KB)
                  </div>
                ) : getPumpAgreementUrl(pump) ? (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Current document: {getPumpAgreementUrl(pump).split('/').pop()}
                  </div>
                ) : null}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isUploadingAgreement}>
                  {isUploadingAgreement ? 'Uploading Agreement...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
