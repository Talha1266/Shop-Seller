import { useState } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { Settings, Plus, X, Trash2 } from 'lucide-react';

export default function Setup() {
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

  const handleDeleteBlock = async (id) => {
    await db.blocks.delete(id);
  };

  const handleDeleteFloor = async (id) => {
    await db.floors.delete(id);
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
                  <button onClick={() => handleDeleteBlock(block.id)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
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
                  <button onClick={() => handleDeleteFloor(floor.id)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
