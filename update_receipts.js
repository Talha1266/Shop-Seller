import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://hximmsduqkxfyofdquiq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aW1tc2R1cWt4ZnlvZmRxdWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDQyNzAsImV4cCI6MjEwMDgyMDI3MH0.JWRGmufDrrqLsyPcLcSJCTdA3hJQ3BKQhdNJmgjEwz0');

async function main() {
  const { data, error } = await supabase.from('payments').select('*').order('date', { ascending: true });
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  const existingReceipts = new Set(data.map(p => p.receiptNo).filter(r => r !== 'XXXX' && r !== 'xxxx'));
  
  let updatedCount = 0;
  for (let i = 0; i < data.length; i++) {
    const payment = data[i];
    if (payment.receiptNo === 'XXXX' || payment.receiptNo === 'xxxx') {
      let newReceipt = '';
      while (true) {
        newReceipt = 'REC-' + Math.floor(100000 + Math.random() * 900000).toString();
        if (!existingReceipts.has(newReceipt)) {
          existingReceipts.add(newReceipt);
          break;
        }
      }
      
      const { error: updateError } = await supabase.from('payments').update({ receiptNo: newReceipt }).eq('id', payment.id);
      if (updateError) {
        console.error('Error updating', payment.id, updateError);
      } else {
        console.log(`Updated Payment ${payment.id}: ${payment.receiptNo} -> ${newReceipt}`);
        updatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} payments.`);
}

main();
