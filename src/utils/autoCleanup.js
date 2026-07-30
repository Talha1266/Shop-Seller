import { supabase } from '../supabaseClient';

/**
 * Automatically deletes any sales, payments, installments, documents,
 * and tenants that are no longer linked to an existing shop.
 * Runs silently in the background — no alerts, no UI interaction.
 */
export async function purgeOrphanedData(projectId) {
  try {
    // 1. Get all shop IDs for this project
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('project_id', projectId);

    const validShopIds = new Set((shops || []).map(s => s.id));

    // 2. Get all sales for this project
    const { data: allSales } = await supabase
      .from('sales')
      .select('id, shopId, tenantId')
      .eq('project_id', projectId);

    const orphanedSales = (allSales || []).filter(s => !validShopIds.has(s.shopId));
    if (orphanedSales.length === 0) return; // nothing to clean

    const orphanedSaleIds = orphanedSales.map(s => s.id);
    const orphanedTenantIds = [...new Set(orphanedSales.map(s => s.tenantId).filter(Boolean))];

    // 3. Delete payments by saleId
    if (orphanedSaleIds.length > 0) {
      await supabase.from('payments').delete().in('saleId', orphanedSaleIds);
      await supabase.from('installments').delete().in('sale_id', orphanedSaleIds);
    }

    // 4. Delete payments + documents by tenantId
    if (orphanedTenantIds.length > 0) {
      await supabase.from('payments').delete().in('tenantId', orphanedTenantIds);
      await supabase.from('documents').delete().in('tenantId', orphanedTenantIds);
    }

    // 5. Delete orphaned sales
    if (orphanedSaleIds.length > 0) {
      await supabase.from('sales').delete().in('id', orphanedSaleIds);
    }

    // 6. Delete orphaned tenants
    if (orphanedTenantIds.length > 0) {
      await supabase.from('tenants').delete().in('id', orphanedTenantIds);
    }

    console.log(`[AutoCleanup] Removed ${orphanedSales.length} orphaned sale(s) and related records.`);
  } catch (err) {
    console.error('[AutoCleanup] Failed to purge orphaned data:', err);
  }
}
