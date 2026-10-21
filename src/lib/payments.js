// Shared payment status logic — used by the Payments page, Dashboard, and Reports.
export const PAYMENT_TONE = { not_invoiced: 'neutral', invoiced: 'info', overdue: 'danger', paid: 'success', short_paid: 'warning' };

export function paymentStatus(p, expectedDays = 30) {
  if (!p || !p.invoice_date) return 'not_invoiced';
  if (p.paid_date && Number(p.invoice_amount) && Number(p.amount_received) < Number(p.invoice_amount)) return 'short_paid';
  if (p.paid_date) return 'paid';
  const days = Math.floor((Date.now() - new Date(p.invoice_date)) / 86400000);
  if (days > (expectedDays || 30)) return 'overdue';
  return 'invoiced';
}