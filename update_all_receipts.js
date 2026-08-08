import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://hximmsduqkxfyofdquiq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aW1tc2R1cWt4ZnlvZmRxdWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDQyNzAsImV4cCI6MjEwMDgyMDI3MH0.JWRGmufDrrqLsyPcLcSJCTdA3hJQ3BKQhdNJmgjEwz0');

async function main() {
  console.log("Checking payments table...");
  const { data: paymentsData, error: paymentsError } = await supabase.from('payments').select('*');
  if (paymentsError) console.error('Error fetching payments:', paymentsError);
  
  let existingReceipts = new Set(paymentsData.map(p => p.receiptNo).filter(r => r !== 'XXXX' && r !== 'xxxx'));
  
  let pUpdatedCount = 0;
  for (let i = 0; i < paymentsData.length; i++) {
    const payment = paymentsData[i];
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
        console.error('Error updating payment', payment.id, updateError);
      } else {
        console.log(`Updated Payment ${payment.id}: ${payment.receiptNo} -> ${newReceipt}`);
        pUpdatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${pUpdatedCount} payments.`);
  
  console.log("Checking rent_collections table...");
  const { data: rentData, error: rentError } = await supabase.from('rent_collections').select('*');
  if (rentError) console.error('Error fetching rent_collections:', rentError);
  
  // also add rent receipts to existing receipts just to be safe
  rentData.forEach(r => {
    if (r.receipt_no && r.receipt_no !== 'XXXX' && r.receipt_no !== 'xxxx') {
      existingReceipts.add(r.receipt_no);
    }
  });

  let rUpdatedCount = 0;
  for (let i = 0; i < rentData.length; i++) {
    const rent = rentData[i];
    if (rent.receipt_no === 'XXXX' || rent.receipt_no === 'xxxx') {
      let newReceipt = '';
      while (true) {
        newReceipt = 'REC-' + Math.floor(100000 + Math.random() * 900000).toString();
        if (!existingReceipts.has(newReceipt)) {
          existingReceipts.add(newReceipt);
          break;
        }
      }
      
      const { error: updateError } = await supabase.from('rent_collections').update({ receipt_no: newReceipt }).eq('id', rent.id);
      if (updateError) {
        console.error('Error updating rent', rent.id, updateError);
      } else {
        console.log(`Updated Rent ${rent.id}: ${rent.receipt_no} -> ${newReceipt}`);
        rUpdatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${rUpdatedCount} rent collections.`);
}

main();
