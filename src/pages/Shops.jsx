import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { Plus, X, Layers, ChevronDown, ChevronRight, Store, Trash2 } from 'lucide-react';

export default function Shops() {
  const db = useDb();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [expandedFloors, setExpandedFloors] = useState({});

  const shops = useSupabase('shops') || [];
  const blocks = useSupabase('blocks') || [];
  const floors = useSupabase('floors') || [];
  const sales = useSupabase('sales') || [];
  const payments = useSupabase('payments') || [];
  const tenants = useSupabase('tenants') || [];

  const toggleBlock = (block) => {
    setExpandedBlocks(prev => ({ ...prev, [block]: !prev[block] }));
  };

  const toggleFloor = (blockFloorKey) => {
    setExpandedFloors(prev => ({ ...prev, [blockFloorKey]: !prev[blockFloorKey] }));
  };

  const getShopBalance = (shopId) => {
    const sale = sales.find(s => s.shopId === shopId);
    if (!sale) return { balance: 0, allocatedAmount: 0 };
    
    // Get all sales for this tenant, sorted by ID for deterministic distribution
    const tenantSales = sales.filter(s => s.tenantId === sale.tenantId).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    
    // Get all payments for this tenant
    const tenantPayments = payments.filter(p => p.tenantId === sale.tenantId || tenantSales.some(ts => ts.id === p.saleId));
    const totalPaymentPool = tenantPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    let remainingPool = totalPaymentPool;
    
    for (const ts of tenantSales) {
      let saleTotal = parseFloat(ts.totalAmount || 0);
      let advance = parseFloat(ts.advancePayment || 0);
      let saleOwed = saleTotal - advance;
      
      let amountPaidFromPool = Math.min(saleOwed, remainingPool);
      remainingPool -= amountPaidFromPool;
      
      let currentSaleBalance = saleOwed - amountPaidFromPool;
      
      if (ts.shopId === shopId) {
        return { balance: currentSaleBalance, allocatedAmount: saleTotal };
      }
    }
    return { balance: 0, allocatedAmount: 0 };
  };

  const calculatePendingForShops = (shopList) => {
    let totalPending = 0;
    shopList.forEach(shop => {
      if (shop.status === 'Occupied') {
        const { balance } = getShopBalance(shop.id);
        if (balance > 0) {
          totalPending += balance;
        }
      }
    });
    return totalPending;
  };

  const handleRowClick = (shop) => {
    if (shop.status === 'Occupied') {
      const sale = sales.find(s => s.shopId === shop.id);
      if (sale) {
        navigate('/ledger', { state: { tenantId: sale.tenantId } });
      }
    } else if (shop.status === 'Available') {
      navigate('/tenants', { state: { preSelectShopId: shop.id } });
    }
  };

  const handleDeleteShop = async (e, shop) => {
    e.stopPropagation();
    
    if (shop.status === 'Occupied') {
      const force = window.confirm(`WARNING: Shop ${shop.shopNumber} is SOLD OUT!\n\nDeleting this shop will permanently erase its sale record, tenant association, and all payment history.\n\nAre you absolutely sure you want to FORCE DELETE it?`);
      if (force) {
        try {
          const shopSale = sales.find(s => s.shopId === shop.id);
          if (shopSale) {
            // Delete payments and installments tied to this tenant
            if (shopSale.tenantId) {
              await supabase.from('payments').delete().eq('tenantId', shopSale.tenantId);
              await supabase.from('documents').delete().eq('tenantId', shopSale.tenantId);
            }
            // Fallback for older data that might only have saleId
            await supabase.from('payments').delete().eq('saleId', shopSale.id);
            await supabase.from('installments').delete().eq('sale_id', shopSale.id);
            
            // Delete the sale
            await db.sales.delete(shopSale.id);
            
            // Delete the tenant
            if (shopSale.tenantId) {
              await supabase.from('tenants').delete().eq('id', shopSale.tenantId);
            }
          }

          // Delete the shop itself
          await db.shops.delete(shop.id);
          alert(`Shop ${shop.shopNumber} and all its records have been deleted.`);
        } catch (err) {
          console.error(err);
          alert("Failed to force delete shop. Error: " + err.message);
        }
      }
      return;
    }

    if (window.confirm(`Are you sure you want to delete Shop ${shop.shopNumber}?`)) {
      await db.shops.delete(shop.id);
    }
  };

  const handleAddShop = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const block = formData.get('block');
    const floor = formData.get('floor');
    const price = parseFloat(formData.get('price'));

    if (!block || !floor) {
      alert('Please select a Block and a Floor.');
      return;
    }
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price.');
      return;
    }

    try {
      if (isBulkAdd) {
        const startSerial = parseInt(formData.get('startSerial'));
        const endSerial = parseInt(formData.get('endSerial'));
        const side = formData.get('side') || 'Front';

        if (isNaN(startSerial) || isNaN(endSerial) || startSerial > endSerial) {
          alert('Please enter a valid serial number range (Start must be ≤ End).');
          return;
        }

        const newShops = [];
        for (let i = startSerial; i <= endSerial; i++) {
          newShops.push({
            shopNumber: `${i}`,
            block: block,
            floor: floor,
            price: price,
            status: 'Available',
            side: side
          });
        }

        if (newShops.length > 0) {
          await db.shops.bulkAdd(newShops);
          alert(`✅ ${newShops.length} shop(s) added successfully!`);
        }
      } else {
        const shopNumber = formData.get('shopNumber');
        const side = formData.get('side') || 'Front';

        if (!shopNumber) {
          alert('Please enter a shop number.');
          return;
        }

        const newShop = {
          shopNumber,
          block,
          floor,
          price,
          status: 'Available',
          side
        };
        await db.shops.add(newShop);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to add shop(s):', err);
      alert('Failed to add shop(s). Error: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleDeleteBlock = async (e, blockName) => {
    e.stopPropagation();
    const force = window.confirm(`WARNING: Deleting block "${blockName}" will permanently destroy ALL shops inside it, including their tenants, sales, and payment history!\n\nAre you absolutely sure you want to FORCE DELETE this block?`);
    if (!force) return;
    
    try {
      // Find all shops in this block
      const blockShops = shops.filter(s => s.block === blockName);
      if (blockShops.length > 0) {
        const shopIds = blockShops.map(s => s.id);
        
        // Find sales
        const blockSales = sales.filter(s => shopIds.includes(s.shopId));
        if (blockSales.length > 0) {
          const saleIds = blockSales.map(s => s.id);
          const tenantIds = blockSales.map(s => s.tenantId).filter(Boolean);
          
          // Delete payments, documents, and installments
          if (tenantIds.length > 0) {
            await supabase.from('payments').delete().in('tenantId', tenantIds);
            await supabase.from('documents').delete().in('tenantId', tenantIds);
          }
          await supabase.from('payments').delete().in('saleId', saleIds);
          await supabase.from('installments').delete().in('sale_id', saleIds);
          
          // Delete sales
          await supabase.from('sales').delete().in('id', saleIds);
          
          // Delete tenants
          if (tenantIds.length > 0) {
            await supabase.from('tenants').delete().in('id', tenantIds);
          }
        }
        
        // Delete shops
        await supabase.from('shops').delete().in('id', shopIds);
      }
      
      // Also delete from setup blocks if it exists there
      const setupBlock = blocks.find(b => b.name === blockName);
      if (setupBlock) {
        await db.blocks.delete(setupBlock.id);
      }
      
      alert(`Block "${blockName}" and all its shops have been deleted.`);
    } catch (err) {
      console.error(err);
      alert("Failed to force delete block. Error: " + err.message);
    }
  };

  // Group shops by Block -> Floor
  const uniqueBlocks = Array.from(new Set(shops.map(s => s.block))).sort();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Shops Management</h1>
        <button className="btn btn-primary" onClick={() => { setIsBulkAdd(false); setIsModalOpen(true); }}>
          <Plus size={18} /> Add Shop
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {shops.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            No shops found. Click "Add Shop" to get started.
          </div>
        ) : (
          uniqueBlocks.map(blockName => {
            const blockShops = shops.filter(s => s.block === blockName);
            const isBlockOpen = expandedBlocks[blockName];
            const floorOrder = {
                // Ground floor variants
                'G.F': 1, 'GF': 1, 'GROUND FLOOR': 1, 'GROUND': 1, 'GROUND F': 1,
                'G F': 1, 'BASEMENT': 0,
                // First floor variants
                'F.F': 2, 'FF': 2, 'FIRST FLOOR': 2, 'FIRST': 2, '1ST FLOOR': 2, '1F': 2, 'FLOOR 1': 2,
                // Second floor variants
                'S.F': 3, 'SF': 3, 'SECOND FLOOR': 3, 'SECOND': 3, '2ND FLOOR': 3, '2F': 3, 'FLOOR 2': 3,
                // Third floor variants
                'T.F': 4, 'TF': 4, 'THIRD FLOOR': 4, 'THIRD': 4, '3RD FLOOR': 4, '3F': 4, 'FLOOR 3': 4,
              };
            const getFloorOrder = (name) => floorOrder[(name || '').toUpperCase()] ?? 99;
            const uniqueFloors = Array.from(new Set(blockShops.map(s => s.floor))).sort((a, b) => {
              const orderA = getFloorOrder(a);
              const orderB = getFloorOrder(b);
              if (orderA !== orderB) return orderA - orderB;
              return a.localeCompare(b);
            });


            return (
              <div key={blockName} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Block Header */}
                <div 
                  style={{ 
                    padding: '1rem 1.5rem', 
                    backgroundColor: 'var(--color-bg-app)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    cursor: 'pointer',
                    borderBottom: isBlockOpen ? '1px solid var(--color-border)' : 'none'
                  }}
                  onClick={() => toggleBlock(blockName)}
                >
                  {isBlockOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Block {blockName}</h2>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="badge badge-neutral">{blockShops.length} Shops</span>
                    {calculatePendingForShops(blockShops) > 0 && (
                      <span className="badge" style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' }}>
                        Pending: Rs. {calculatePendingForShops(blockShops).toLocaleString()}
                      </span>
                    )}
                    <button 
                      onClick={(e) => handleDeleteBlock(e, blockName)}
                      className="icon-btn" 
                      title="Force Delete Block"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Block Content (Floors) */}
                {isBlockOpen && (
                  <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {uniqueFloors.map(floorName => {
                      const floorShops = blockShops.filter(s => s.floor === floorName).sort((a, b) => a.shopNumber.localeCompare(b.shopNumber, undefined, { numeric: true, sensitivity: 'base' }));
                      const blockFloorKey = `${blockName}-${floorName}`;
                      const isFloorOpen = expandedFloors[blockFloorKey];

                      return (
                        <div key={floorName} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                          {/* Floor Header */}
                          <div 
                            style={{ 
                              padding: '0.75rem 1rem', 
                              backgroundColor: '#f8fafc',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderBottom: isFloorOpen ? '1px solid var(--color-border)' : 'none'
                            }}
                            onClick={() => toggleFloor(blockFloorKey)}
                          >
                            {isFloorOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>{floorName}</h3>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{floorShops.length} Shops</span>
                              {calculatePendingForShops(floorShops) > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#c2410c', backgroundColor: '#fff7ed', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fdba74', fontWeight: 500 }}>
                                  Pending: Rs. {calculatePendingForShops(floorShops).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Floor Content (Shops Grid) */}
                          {isFloorOpen && (
                            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                              {floorShops.map(shop => {
                                let paymentStatus = null;
                                let balance = 0;
                                let totalAllocatedAmount = 0;
                                if (shop.status === 'Occupied') {
                                  const shopData = getShopBalance(shop.id);
                                  balance = shopData.balance;
                                  totalAllocatedAmount = shopData.allocatedAmount;

                                  if (balance <= 0) {
                                    paymentStatus = 'Cleared';
                                  } else {
                                    paymentStatus = 'Pending';
                                  }
                                }

                                let bgColor = 'white';
                                let borderColor = 'var(--color-border)';
                                let leftBorderColor = 'var(--color-success)'; // For available
                                
                                if (shop.status === 'Occupied') {
                                  if (paymentStatus === 'Cleared') {
                                    bgColor = 'var(--color-success-bg)';
                                    borderColor = 'var(--color-success)';
                                    leftBorderColor = 'var(--color-success)';
                                  } else {
                                    bgColor = '#fef2f2';
                                    borderColor = '#f87171';
                                    leftBorderColor = '#ef4444';
                                  }
                                }

                                return (
                                  <div 
                                    key={shop.id}
                                    className={shop.status === 'Occupied' ? 'shop-card occupied' : 'shop-card available'}
                                    onClick={() => handleRowClick(shop)}
                                    style={{
                                      border: `1px solid ${borderColor}`,
                                      borderRadius: 'var(--radius-sm)',
                                      padding: '1rem',
                                      backgroundColor: bgColor,
                                      cursor: 'pointer',
                                      boxShadow: 'var(--shadow-sm)',
                                      transition: 'all 0.2s ease',
                                      borderLeft: `4px solid ${leftBorderColor}`
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <Store size={18} color="var(--color-text-muted)" />
                                        <div>
                                          <h4 style={{ margin: 0, fontSize: '1.125rem' }}>{shop.shopNumber}</h4>
                                          {shop.side && (
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 600,
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              backgroundColor: shop.side === 'Front' ? '#eff6ff' : '#fdf4ff',
                                              color: shop.side === 'Front' ? '#1d4ed8' : '#7e22ce',
                                              border: `1px solid ${shop.side === 'Front' ? '#bfdbfe' : '#e9d5ff'}`
                                            }}>
                                              {shop.side === 'Front' ? '🏪 Front' : '🔙 Back'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                                        <span className={`badge ${shop.status === 'Available' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                          {shop.status}
                                        </span>
                                        {paymentStatus && (
                                          <span 
                                            className={`badge ${paymentStatus === 'Cleared' ? 'badge-success' : 'badge-neutral'}`} 
                                            style={{ fontSize: '0.65rem' }}
                                          >
                                            Pymt: {paymentStatus}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {shop.status === 'Occupied' ? (
                                          <>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                              Total: Rs. {totalAllocatedAmount.toLocaleString()}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: balance > 0 ? '#ef4444' : 'var(--color-success)', fontWeight: 600 }}>
                                              Bal: Rs. {balance.toLocaleString()}
                                            </p>
                                          </>
                                        ) : (
                                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                            Price: Rs. {shop.price.toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                      {shop.status === 'Available' && (
                                        <button 
                                          onClick={(e) => handleDeleteShop(e, shop)}
                                          style={{ 
                                            background: 'none', border: 'none', cursor: 'pointer', 
                                            color: '#ef4444', padding: '4px', borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                          }}
                                          title="Delete Shop"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add Shop Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{isBulkAdd ? 'Bulk Add Shops (Serial)' : 'Add New Shop'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <button 
                type="button" 
                className={`btn ${!isBulkAdd ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsBulkAdd(false)}
              >
                <Plus size={16} /> Single Shop
              </button>
              <button 
                type="button" 
                className={`btn ${isBulkAdd ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsBulkAdd(true)}
              >
                <Layers size={16} /> Bulk Add (Serial No)
              </button>
            </div>

            <form onSubmit={handleAddShop}>
              {isBulkAdd ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Start Serial No.</label>
                      <input type="number" name="startSerial" className="form-control" required min="1" placeholder="e.g. 1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Serial No.</label>
                      <input type="number" name="endSerial" className="form-control" required min="1" placeholder="e.g. 20" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Shop Number</label>
                  <input type="text" name="shopNumber" className="form-control" required placeholder="e.g. Shop 12" />
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Block</label>
                {blocks.length > 0 ? (
                  <select name="block" className="form-control" required>
                    <option value="">-- Select Block --</option>
                    {blocks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                ) : (
                  <input type="text" name="block" className="form-control" placeholder="Go to Setup to add blocks" required />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Floor</label>
                {floors.length > 0 ? (
                  <select name="floor" className="form-control" required>
                    <option value="">-- Select Floor --</option>
                    {floors.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                ) : (
                  <input type="text" name="floor" className="form-control" placeholder="Go to Setup to add floors" required />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Default Price per Shop</label>
                <input type="number" name="price" className="form-control" required min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Shop Side</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="radio" name="side" value="Front" defaultChecked style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }} />
                    🏪 Front Side
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="radio" name="side" value="Back" style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }} />
                    🔙 Back Side
                  </label>
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isBulkAdd ? 'Generate Shops' : 'Save Shop'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
