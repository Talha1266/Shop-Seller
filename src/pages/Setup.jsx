import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useDb } from '../hooks/useDb';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';
import { Settings, Plus, X, Trash2 } from 'lucide-react';

export default function Setup() {
  const { activeProject } = useProject();
  const db = useDb();
  const blocks = useSupabase('blocks') || [];
  const floors = useSupabase('floors') || [];

  const [newBlock, setNewBlock] = useState('');
  const [newFloor, setNewFloor] = useState('');

  const handleAddBlock = async (e) => {
    e.preventDefault();
    if (!newBlock.trim()) return;
    await db.blocks.add({ name: newBlock.trim() });
    setNewBlock('');
  };

  const handleAddFloor = async (e) => {
    e.preventDefault();
    if (!newFloor.trim()) return;
    await db.floors.add({ name: newFloor.trim() });
    setNewFloor('');
  };

  const handleDeleteBlock = async (id, blockName) => {
    const force = window.confirm(`WARNING: Deleting block "${blockName}" will permanently destroy ALL shops inside it, including their tenants, sales, and payment history!\n\nAre you absolutely sure you want to FORCE DELETE this block?`);
    if (!force) return;
    
    try {
      // Find all shops in this block for the current project
      const { data: shopsInBlock } = await supabase
        .from('shops')
        .select('id')
        .eq('project_id', activeProject.id)
        .eq('block', blockName);
        
      if (shopsInBlock && shopsInBlock.length > 0) {
        const shopIds = shopsInBlock.map(s => s.id);
        
        // Find all sales for these shops
        const { data: salesInBlock } = await supabase
          .from('sales')
          .select('id, tenantId')
          .eq('project_id', activeProject.id)
          .in('shopId', shopIds);
          
        if (salesInBlock && salesInBlock.length > 0) {
          const saleIds = salesInBlock.map(s => s.id);
          const tenantIds = salesInBlock.map(s => s.tenantId).filter(Boolean);
          
          await supabase.from('payments').delete().in('saleId', saleIds);
          await supabase.from('installments').delete().in('sale_id', saleIds);
          await supabase.from('sales').delete().in('id', saleIds);
          
          if (tenantIds.length > 0) {
            await supabase.from('tenants').delete().in('id', tenantIds);
          }
        }
        
        await supabase.from('shops').delete().in('id', shopIds);
      }
      
      await db.blocks.delete(id);
      alert(`Block "${blockName}" and all its contents were successfully deleted.`);
    } catch (err) {
      console.error(err);
      alert("Failed to force delete block. Error: " + err.message);
    }
  };

  const handleDeleteFloor = async (id, floorName) => {
    const force = window.confirm(`WARNING: Deleting floor "${floorName}" will permanently destroy ALL shops on this floor, including their tenants, sales, and payment history!\n\nAre you absolutely sure you want to FORCE DELETE this floor?`);
    if (!force) return;
    
    try {
      const { data: shopsInFloor } = await supabase
        .from('shops')
        .select('id')
        .eq('project_id', activeProject.id)
        .eq('floor', floorName);
        
      if (shopsInFloor && shopsInFloor.length > 0) {
        const shopIds = shopsInFloor.map(s => s.id);
        
        const { data: salesInFloor } = await supabase
          .from('sales')
          .select('id, tenantId')
          .eq('project_id', activeProject.id)
          .in('shopId', shopIds);
          
        if (salesInFloor && salesInFloor.length > 0) {
          const saleIds = salesInFloor.map(s => s.id);
          const tenantIds = salesInFloor.map(s => s.tenantId).filter(Boolean);
          
          await supabase.from('payments').delete().in('saleId', saleIds);
          await supabase.from('installments').delete().in('sale_id', saleIds);
          await supabase.from('sales').delete().in('id', saleIds);
          
          if (tenantIds.length > 0) {
            await supabase.from('tenants').delete().in('id', tenantIds);
          }
        }
        
        await supabase.from('shops').delete().in('id', shopIds);
      }
      
      await db.floors.delete(id);
      alert(`Floor "${floorName}" and all its contents were successfully deleted.`);
    } catch (err) {
      console.error(err);
      alert("Failed to force delete floor. Error: " + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Plaza Setup</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} /> Blocks
          </h2>
          <form onSubmit={handleAddBlock} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Block A" 
              value={newBlock}
              onChange={e => setNewBlock(e.target.value)}
            />
            <button type="submit" className="btn btn-primary"><Plus size={18} /> Add</button>
          </form>
          
          <ul style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            {blocks.length === 0 ? (
              <li style={{ color: 'var(--color-text-muted)' }}>No blocks added yet.</li>
            ) : (
              blocks.map(block => (
                <li key={block.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{block.name}</span>
                  <button onClick={() => handleDeleteBlock(block.id, block.name)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} /> Floors
          </h2>
          <form onSubmit={handleAddFloor} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Ground Floor" 
              value={newFloor}
              onChange={e => setNewFloor(e.target.value)}
            />
            <button type="submit" className="btn btn-primary"><Plus size={18} /> Add</button>
          </form>
          
          <ul style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            {floors.length === 0 ? (
              <li style={{ color: 'var(--color-text-muted)' }}>No floors added yet.</li>
            ) : (
              floors.map(floor => (
                <li key={floor.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{floor.name}</span>
                  <button onClick={() => handleDeleteFloor(floor.id, floor.name)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
