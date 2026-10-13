import { useState, useMemo } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingCart, DollarSign, Wallet, Bell, AlertCircle, HardHat, TrendingDown, X, Search, Clock } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6', '#ef4444'];

export default function Dashboard() {
  const db = useDb();
  const navigate = useNavigate();
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];
  const contractorPayments = useSupabase('contractor_payments') || [];
  const tenants = useSupabase('tenants') || [];
  const rentCollections = useSupabase('rent_collections') || [];

  const occupiedShopIds = new Set(shops.filter(s => s.status === 'Occupied').map(s => s.id));

  // Deduplicate to get only the latest sale per occupied shop
  const latestSalesMap = new Map();
  sales.forEach(s => {
    if (occupiedShopIds.has(s.shopId)) {
      const existing = latestSalesMap.get(s.shopId);
      if (!existing || new Date(s.date || 0) > new Date(existing.date || 0)) {
        latestSalesMap.set(s.shopId, s);
      }
    }
  });
  
  const activeSales = Array.from(latestSalesMap.values());
  const activeSaleIds = new Set(activeSales.map(s => s.id));
  const activeTenantIds = new Set(activeSales.map(s => s.tenantId).filter(Boolean));

  // Only count payments tied to active sales/tenants
  const activePayments = payments.filter(p =>
    (p.saleId && activeSaleIds.has(p.saleId)) ||
    (p.tenantId && activeTenantIds.has(p.tenantId))
  );

  const shopsCount = shops.length;
  const shopsSold = shops.filter(s => s.status === 'Occupied').length;

  const totalRevenueExpected = activeSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || 0), 0);
  const totalReceived = activePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) +
                        activeSales.reduce((sum, sale) => sum + parseFloat(sale.advancePayment || 0), 0);
  
  const tenantOutstanding = totalRevenueExpected - totalReceived;

  const maxPotentialRevenue = shops.reduce((sum, shop) => {
    if (shop.status === 'Occupied') {
      const sale = activeSales.find(s => s.shopId === shop.id);
      return sum + (sale ? parseFloat(sale.totalAmount || 0) : parseFloat(shop.price || 0));
    } else {
      return sum + parseFloat(shop.price || 0);
    }
  }, 0);

  const totalContractorPaid = contractorPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const contractorPending = maxPotentialRevenue - totalContractorPaid;

  const currentMonthString = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const expectedRent = activeSales.reduce((sum, sale) => {
    const shop = shops.find(s => s.id === sale.shopId);
    return sum + parseFloat(sale.monthly_rent || shop?.monthly_rent || 0);
  }, 0);

  const collectedRentThisMonth = rentCollections
    .filter(rc => rc.month === currentMonthString)
    .reduce((sum, rc) => sum + parseFloat(rc.amount_paid || 0), 0);

  const [isFinesModalOpen, setIsFinesModalOpen] = useState(false);
  const [finesFilterTab, setFinesFilterTab] = useState('all');
  const [finesSearchQuery, setFinesSearchQuery] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const calculateFine = (monthString, paymentDate) => {
    if (!monthString) return 0;
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

  const totalFinesCollected = useMemo(() => {
    return rentCollections.reduce((sum, rc) => sum + parseFloat(rc.fine_amount || 0), 0);
  }, [rentCollections]);

  const finesCollectedThisMonth = useMemo(() => {
    return rentCollections
      .filter(rc => rc.month === currentMonthString)
      .reduce((sum, rc) => sum + parseFloat(rc.fine_amount || 0), 0);
  }, [rentCollections, currentMonthString]);

  // Active overdue fines for unpaid shops for current month
  const overdueFinePerShop = calculateFine(currentMonthString, todayStr);
  const overdueShops = useMemo(() => {
    if (overdueFinePerShop <= 0) return [];
    const list = [];
    activeSales.forEach(sale => {
      const shop = shops.find(s => s.id === sale.shopId);
      const rentDue = parseFloat(sale.monthly_rent || shop?.monthly_rent || 0);
      if (rentDue > 0) {
        const monthPayments = rentCollections.filter(rc => rc.sale_id === sale.id && rc.month === currentMonthString);
        const amountPaid = monthPayments.reduce((sum, rc) => sum + parseFloat(rc.amount_paid || 0), 0);
        const balance = rentDue - amountPaid;
        if (balance > 0) {
          const tenant = tenants.find(t => t.id === sale.tenantId);
          list.push({
            sale,
            shop,
            tenant,
            balance,
            fineAmount: overdueFinePerShop
          });
        }
      }
    });
    return list;
  }, [activeSales, shops, rentCollections, currentMonthString, overdueFinePerShop, tenants]);

  const totalOverdueFines = overdueShops.reduce((sum, item) => sum + item.fineAmount, 0);

  // Fines waived count / amount
  const waivedFinesList = useMemo(() => {
    return rentCollections.filter(rc => rc.notes && (rc.notes.includes('Waived') || rc.notes.includes('Maafi') || rc.notes.includes('معاف')));
  }, [rentCollections]);

  const totalWaivedAmount = useMemo(() => {
    return waivedFinesList.reduce((sum, rc) => {
      const m = rc.notes?.match(/Rs\.\s*([\d,]+)/);
      return sum + (m ? (parseFloat(m[1].replace(/,/g, '')) || 0) : 0);
    }, 0);
  }, [waivedFinesList]);

  // Comprehensive fines list for the modal
  const finesList = useMemo(() => {
    const list = [];

    // 1. Collected & Waived Fines from rentCollections
    rentCollections.forEach(rc => {
      const fineVal = parseFloat(rc.fine_amount || 0);
      const isWaived = (rc.notes && (rc.notes.includes('Waived') || rc.notes.includes('Maafi') || rc.notes.includes('معاف')));
      
      let waivedAmount = 0;
      if (isWaived) {
        const m = rc.notes?.match(/Rs\.\s*([\d,]+)/);
        if (m) waivedAmount = parseFloat(m[1].replace(/,/g, '')) || 0;
      }

      if (fineVal > 0) {
        const sale = sales.find(s => s.id === rc.sale_id);
        const shop = sale ? shops.find(s => s.id === sale.shopId) : null;
        const tenant = sale ? tenants.find(t => t.id === sale.tenantId) : (rc.tenant_id ? tenants.find(t => t.id === rc.tenant_id) : null);

        list.push({
          id: `col-${rc.id}`,
          type: 'collected',
          status: 'Collected',
          month: rc.month,
          date: rc.date,
          receiptNo: rc.receipt_no,
          baseRent: parseFloat(rc.amount_paid || 0),
          fineAmount: fineVal,
          shop,
          tenant,
          sale,
          notes: rc.notes || ''
        });
      } else if (isWaived && waivedAmount > 0) {
        const sale = sales.find(s => s.id === rc.sale_id);
        const shop = sale ? shops.find(s => s.id === sale.shopId) : null;
        const tenant = sale ? tenants.find(t => t.id === sale.tenantId) : (rc.tenant_id ? tenants.find(t => t.id === rc.tenant_id) : null);

        list.push({
          id: `wvd-${rc.id}`,
          type: 'waived',
          status: 'Waived (Fine Maafi)',
          month: rc.month,
          date: rc.date,
          receiptNo: rc.receipt_no,
          baseRent: parseFloat(rc.amount_paid || 0),
          fineAmount: waivedAmount,
          shop,
          tenant,
          sale,
          notes: rc.notes || ''
        });
      }
    });

    // 2. Active Overdue Fines for unpaid shops past 10th
    overdueShops.forEach(item => {
      list.push({
        id: `ovd-${item.sale.id}`,
        type: 'overdue',
        status: 'Overdue (Past 10th)',
        month: currentMonthString,
        date: todayStr,
        receiptNo: 'Pending Payment',
        baseRent: item.balance,
        fineAmount: item.fineAmount,
        shop: item.shop,
        tenant: item.tenant,
        sale: item.sale,
        notes: `${Math.ceil(item.fineAmount / 100)} days late past 10th @ Rs. 100/day`
      });
    });

    return list.sort((a, b) => {
      if (a.type === 'overdue' && b.type !== 'overdue') return -1;
      if (b.type === 'overdue' && a.type !== 'overdue') return 1;
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }, [rentCollections, sales, shops, tenants, overdueShops, currentMonthString, todayStr]);

  const filteredFines = useMemo(() => {
    return finesList.filter(item => {
      if (finesFilterTab === 'collected' && item.type !== 'collected') return false;
      if (finesFilterTab === 'overdue' && item.type !== 'overdue') return false;
      if (finesFilterTab === 'waived' && item.type !== 'waived') return false;

      if (finesSearchQuery) {
        const q = finesSearchQuery.toLowerCase();
        const shopStr = item.shop ? `shop ${item.shop.shopNumber} ${item.shop.block}`.toLowerCase() : '';
        const tenantStr = item.tenant ? `${item.tenant.name} ${item.tenant.mobile}`.toLowerCase() : '';
        const receiptStr = String(item.receiptNo || '').toLowerCase();
        const monthStr = String(item.month || '').toLowerCase();
        return shopStr.includes(q) || tenantStr.includes(q) || receiptStr.includes(q) || monthStr.includes(q);
      }
      return true;
    });
  }, [finesList, finesFilterTab, finesSearchQuery]);

  const stats = [
    { label: 'Total Shops', value: shopsCount, icon: Store, color: '#2563eb', bg: '#eff6ff', link: '/shops' },
    { label: 'Shops Occupied', value: shopsSold, icon: ShoppingCart, color: '#10b981', bg: '#d1fae5', link: '/shops' },
    { label: 'Expected Revenue', value: `Rs. ${totalRevenueExpected.toLocaleString()}`, icon: DollarSign, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Total Received', value: `Rs. ${totalReceived.toLocaleString()}`, icon: Wallet, color: '#8b5cf6', bg: '#ede9fe' },
    { label: 'Expected Rent (Monthly)', value: `Rs. ${expectedRent.toLocaleString()}`, icon: DollarSign, color: '#0ea5e9', bg: '#e0f2fe', link: '/rent' },
    { label: 'Rent Collected (This Month)', value: `Rs. ${collectedRentThisMonth.toLocaleString()}`, icon: Wallet, color: '#0ea5e9', bg: '#e0f2fe', link: '/rent' },
    { 
      label: 'Fine on Rent', 
      value: `Rs. ${(totalFinesCollected > 0 ? totalFinesCollected : totalOverdueFines).toLocaleString()}`, 
      subtext: totalFinesCollected > 0 
        ? (totalOverdueFines > 0 ? `+ Rs. ${totalOverdueFines.toLocaleString()} overdue` : (finesCollectedThisMonth > 0 ? `Rs. ${finesCollectedThisMonth.toLocaleString()} this month` : 'All-time collected'))
        : (totalOverdueFines > 0 ? `${overdueShops.length} shops overdue past 10th` : 'No active fines'),
      icon: AlertCircle, 
      color: '#dc2626', 
      bg: '#fee2e2', 
      onClick: () => setIsFinesModalOpen(true) 
    },
    { label: 'Tenant Outstanding', value: `Rs. ${tenantOutstanding.toLocaleString()}`, icon: AlertCircle, color: '#ef4444', bg: '#fee2e2' },
    { label: 'Total Value (Max Rev)', value: `Rs. ${maxPotentialRevenue.toLocaleString()}`, icon: DollarSign, color: '#ec4899', bg: '#fce7f3' },
    { label: 'Contractor Paid', value: `Rs. ${totalContractorPaid.toLocaleString()}`, icon: HardHat, color: '#10b981', bg: '#d1fae5', link: '/contractor' },
    { label: 'Contractor Pending', value: `Rs. ${contractorPending.toLocaleString()}`, icon: TrendingDown, color: '#f59e0b', bg: '#fef3c7', link: '/contractor' }
  ];

  // Process data for Occupancy Pie Chart
  const blockOccupancy = {};
  shops.forEach(shop => {
    if (!blockOccupancy[shop.block]) {
      blockOccupancy[shop.block] = { name: `Block ${shop.block}`, Occupied: 0, Available: 0 };
    }
    if (shop.status === 'Occupied') blockOccupancy[shop.block].Occupied += 1;
    else blockOccupancy[shop.block].Available += 1;
  });
  const pieData = Object.values(blockOccupancy).map(b => ({ name: b.name, value: b.Occupied }));

  // Revenue Area Chart — only active sales advances + active payments
  const monthlyRevenue = {};
  activeSales.forEach(sale => {
    const month = new Date(sale.date).toISOString().slice(0, 7);
    if (!monthlyRevenue[month]) monthlyRevenue[month] = 0;
    monthlyRevenue[month] += parseFloat(sale.advancePayment || 0);
  });
  activePayments.forEach(payment => {
    const month = new Date(payment.date).toISOString().slice(0, 7);
    if (!monthlyRevenue[month]) monthlyRevenue[month] = 0;
    monthlyRevenue[month] += parseFloat(payment.amount || 0);
  });

  const areaData = Object.keys(monthlyRevenue).sort().map(month => ({
    name: month,
    Revenue: monthlyRevenue[month]
  }));


  // Top Outstanding Balances
  const outstandingBalances = tenants.map(tenant => {
    const tenantSales = sales.filter(s => s.tenantId === tenant.id);
    if (tenantSales.length === 0) return null;
    
    const tenantPayments = payments.filter(p => p.tenantId === tenant.id || tenantSales.some(s => s.id === p.saleId));
    
    const totalAmount = tenantSales.reduce((sum, s) => sum + parseFloat(s.totalAmount || 0), 0);
    const totalAdvance = tenantSales.reduce((sum, s) => sum + parseFloat(s.advancePayment || 0), 0);
    const totalPaid = tenantPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + totalAdvance;
    const balance = totalAmount - totalPaid;
    
    const tenantShopsList = tenantSales.map(sale => shops.find(s => s.id === sale.shopId)).filter(Boolean);
    
    return { tenant, tenantShops: tenantShopsList, totalAmount, totalPaid, balance };
  }).filter(Boolean).filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  // Top Rent Defaulters
  const topRentDefaulters = tenants.map(tenant => {
    const tenantSales = activeSales.filter(s => s.tenantId === tenant.id);
    if (tenantSales.length === 0) return null;
    
    let totalRentDue = 0;
    let totalRentPaid = 0;
    const defaultingShops = [];
    
    tenantSales.forEach(sale => {
      const shop = shops.find(s => s.id === sale.shopId);
      const rentDue = parseFloat(sale.monthly_rent || shop?.monthly_rent || 0);
      if (rentDue > 0) {
        totalRentDue += rentDue;
        const monthPayments = rentCollections.filter(rc => rc.sale_id === sale.id && rc.month === currentMonthString);
        const amountPaid = monthPayments.reduce((sum, rc) => sum + parseFloat(rc.amount_paid || 0), 0);
        totalRentPaid += amountPaid;
        
        if (rentDue - amountPaid > 0) {
          defaultingShops.push(shop);
        }
      }
    });
    
    const balance = totalRentDue - totalRentPaid;
    
    return { tenant, defaultingShops, totalRentDue, totalRentPaid, balance };
  }).filter(Boolean).filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              cursor: (stat.link || stat.onClick) ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
            onClick={() => {
              if (stat.onClick) stat.onClick();
              else if (stat.link) navigate(stat.link);
            }}
            onMouseEnter={(stat.link || stat.onClick) ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; } : undefined}
            onMouseLeave={(stat.link || stat.onClick) ? (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; } : undefined}
          >
            <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <stat.icon size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>{stat.value}</h3>
              {stat.subtext && (
                <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', fontWeight: 600, color: stat.color }}>
                  {stat.subtext}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Area Chart: Revenue Trend */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Revenue Collection Trend</h2>
          {areaData.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    dy={10}
                    tickFormatter={(tickItem) => {
                      if (!tickItem) return '';
                      const [year, month] = tickItem.split('-');
                      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <RechartsTooltip 
                    cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const [year, month] = label.split('-');
                        const formattedDate = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        return (
                          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(8px)' }}>
                            <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>{formattedDate}</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: '#8b5cf6' }}>
                              Rs. {payload[0].value.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
               Not enough data to display trend.
             </div>
          )}
        </div>

        {/* Pie Chart: Occupancy by Block */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Occupied Shops by Block</h2>
          {pieData.filter(d => d.value > 0).length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
               No occupied shops yet.
            </div>
          )}
        </div>
      </div>

      {/* Outstanding Balances Widget */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Bell size={20} color="#ef4444" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Top Outstanding Balances</h2>
        </div>
        
        {outstandingBalances.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Shop Number</th>
                  <th>Total Price</th>
                  <th>Amount Paid</th>
                  <th>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {outstandingBalances.map(item => {
                  return (
                    <tr key={item.tenant.id}>
                      <td style={{ fontWeight: 500 }}>{item.tenant.name}</td>
                      <td>{item.tenantShops.length > 0 ? item.tenantShops.map(s => `Shop ${s.shopNumber} (Block ${s.block})`).join(', ') : 'N/A'}</td>
                      <td>Rs. {item.totalAmount.toLocaleString()}</td>
                      <td style={{ color: '#10b981' }}>Rs. {item.totalPaid.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: '#b91c1c' }}>Rs. {item.balance.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>There are no outstanding balances.</p>
        )}
      </div>

      {/* Top Rent Defaulters Widget */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Bell size={20} color="#ef4444" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Top Rent Defaulters (This Month)</h2>
        </div>
        
        {topRentDefaulters.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Shop Number</th>
                  <th>Rent Due</th>
                  <th>Rent Paid</th>
                  <th>Unpaid Rent</th>
                </tr>
              </thead>
              <tbody>
                {topRentDefaulters.map(item => {
                  return (
                    <tr key={item.tenant.id}>
                      <td style={{ fontWeight: 500 }}>{item.tenant.name}</td>
                      <td>{item.defaultingShops.length > 0 ? item.defaultingShops.map(s => `Shop ${s.shopNumber} (Block ${s.block})`).join(', ') : 'N/A'}</td>
                      <td>Rs. {item.totalRentDue.toLocaleString()}</td>
                      <td style={{ color: '#10b981' }}>Rs. {item.totalRentPaid.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: '#b91c1c' }}>Rs. {item.balance.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>There are no rent defaulters for this month.</p>
        )}
      </div>

      {isFinesModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFinesModalOpen(false)}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
          >
            {/* Header */}
            <div className="modal-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                  <AlertCircle size={22} color="#dc2626" />
                  Fine on Rent Details
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Complete record of collected late fines, active overdue fines past due date (10th of month), and waived fines.
                </p>
              </div>
              <button className="modal-close" onClick={() => setIsFinesModalOpen(false)}><X size={22} /></button>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>TOTAL COLLECTED</p>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', color: '#b91c1c', fontWeight: 700 }}>
                  Rs. {totalFinesCollected.toLocaleString()}
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#7f1d1d' }}>All-time paid fines</span>
              </div>

              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>THIS MONTH COLLECTED</p>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', color: '#1d4ed8', fontWeight: 700 }}>
                  Rs. {finesCollectedThisMonth.toLocaleString()}
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#1e3a8a' }}>{currentMonthString}</span>
              </div>

              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412', fontWeight: 600 }}>ACTIVE OVERDUE</p>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', color: '#c2410c', fontWeight: 700 }}>
                  Rs. {totalOverdueFines.toLocaleString()}
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#7c2d12' }}>{overdueShops.length} shops pending</span>
              </div>

              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>FINE MAAFI (WAIVED)</p>
                <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', color: '#15803d', fontWeight: 700 }}>
                  Rs. {totalWaivedAmount.toLocaleString()}
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#14532d' }}>{waivedFinesList.length} waivers granted</span>
              </div>
            </div>

            {/* Filter Tabs and Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `All (${finesList.length})` },
                  { key: 'overdue', label: `Overdue (${overdueShops.length})` },
                  { key: 'collected', label: `Collected (${finesList.filter(f => f.type === 'collected').length})` },
                  { key: 'waived', label: `Waived / Maafi (${waivedFinesList.length})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`btn ${finesFilterTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => setFinesFilterTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '220px', flex: '1', maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search tenant, shop, receipt..."
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                  value={finesSearchQuery}
                  onChange={e => setFinesSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="table-container" style={{ flex: 1, overflowY: 'auto', maxHeight: '45vh', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Tenant</th>
                    <th>Month</th>
                    <th>Date / Status</th>
                    <th>Base Rent</th>
                    <th>Fine Amount</th>
                    <th>Fine Type</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFines.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        No fine records found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFines.map(item => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.shop ? `Shop ${item.shop.shopNumber}` : 'N/A'}</strong>
                          {item.shop && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Block {item.shop.block}, {item.shop.floor}</span>}
                        </td>
                        <td>
                          <strong>{item.tenant?.name || 'N/A'}</strong>
                          {item.tenant?.mobile && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.tenant.mobile}</span>}
                        </td>
                        <td>{item.month || '—'}</td>
                        <td>
                          <div>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</div>
                          {item.receiptNo && item.receiptNo !== 'Pending Payment' && (
                            <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 600 }}>#{item.receiptNo}</span>
                          )}
                        </td>
                        <td>Rs. {Number(item.baseRent || 0).toLocaleString()}</td>
                        <td style={{ fontWeight: 700, color: item.type === 'waived' ? '#15803d' : '#dc2626' }}>
                          Rs. {Number(item.fineAmount || 0).toLocaleString()}
                        </td>
                        <td>
                          {item.type === 'collected' && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                              Collected
                            </span>
                          )}
                          {item.type === 'overdue' && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                              Overdue (Past 10th)
                            </span>
                          )}
                          {item.type === 'waived' && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                              Waived (Fine Maafi)
                            </span>
                          )}
                          {item.notes && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.notes}>
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => {
                              setIsFinesModalOpen(false);
                              navigate('/rent', { state: { tenantSearch: item.tenant?.name, month: item.month, filter: item.type === 'overdue' ? 'fines' : undefined } });
                            }}
                          >
                            Open in Rent
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Late fine is calculated at Rs. 100/day for payments made after the 10th of each month.
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFinesModalOpen(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setIsFinesModalOpen(false);
                    navigate('/rent');
                  }}
                >
                  Go to Rent & Maintenance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
