-- Fix Shops
alter table public.shops rename column shop_number to "shopNumber";

-- Fix Sales
alter table public.sales rename column shop_id to "shopId";
alter table public.sales rename column tenant_id to "tenantId";
alter table public.sales rename column total_amount to "totalAmount";
alter table public.sales rename column advance_payment to "advancePayment";
alter table public.sales rename column is_completed to "isCompleted";

-- Fix Installments
alter table public.installments rename column sale_id to "saleId";
alter table public.installments rename column tenant_id to "tenantId";
alter table public.installments rename column due_date to "dueDate";

-- Fix Payments
alter table public.payments rename column sale_id to "saleId";
alter table public.payments rename column receipt_no to "receiptNo";

-- Fix Documents
alter table public.documents rename column tenant_id to "tenantId";
