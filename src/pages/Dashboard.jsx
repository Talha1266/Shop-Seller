import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Store, ShoppingCart, DollarSign, Wallet, Bell } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6', '#ef4444'];

export default function Dashboard() {
  const db = useDb();
  const shops = useSupabase('shops') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];

  const tenants = useSupabase('tenants') || [];

  const occupiedShopIds = new Set(shops.filter(s => s.status === 'Occupied').map(s => s.id));

  // Only count sales that belong to an existing occupied shop
  const activeSales = sales.filter(s => occupiedShopIds.has(s.shopId));
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
  
  const maxPotentialRevenue = shops.reduce((sum, shop) => {
    if (shop.status === 'Occupied') {
      const sale = activeSales.find(s => s.shopId === shop.id);
      return sum + (sale ? parseFloat(sale.totalAmount || 0) : parseFloat(shop.price || 0));
    } else {
      return sum + parseFloat(shop.price || 0);
    }
  }, 0);

  const stats = [
    { label: 'Total Shops', value: shopsCount, icon: Store, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Shops Occupied', value: shopsSold, icon: ShoppingCart, color: '#10b981', bg: '#d1fae5' },
    { label: 'Total Value (Max Rev)', value: `Rs. ${maxPotentialRevenue.toLocaleString()}`, icon: DollarSign, color: '#ec4899', bg: '#fce7f3' },
    { label: 'Expected Revenue', value: `Rs. ${totalRevenueExpected.toLocaleString()}`, icon: DollarSign, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Total Received', value: `Rs. ${totalReceived.toLocaleString()}`, icon: Wallet, color: '#8b5cf6', bg: '#ede9fe' }
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <stat.icon size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>{stat.value}</h3>
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
    </div>
  );
}
