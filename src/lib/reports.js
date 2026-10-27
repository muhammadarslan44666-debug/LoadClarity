// Report builders for the Reports section — all values come from real saved data.
import { currency, pct, num, dateStr, STATUS_LABELS, titleCase } from './format';
import { computeEconomics, computeDispatcherShare, computeDetention } from './calculations';
import { paymentStatus } from './payments';

export const REPORT_TYPES = [
  { id: 'load', label: 'Load Report' },
  { id: 'profit', label: 'Profit Report' },
  { id: 'revenue', label: 'Revenue Report' },
  { id: 'fee', label: 'Dispatcher Fee Report' },
  { id: 'broker', label: 'Broker Report' },
  { id: 'carrier', label: 'Carrier Report' },
  { id: 'exception', label: 'Exception Report' },
  { id: 'detention', label: 'Detention Report' },
  { id: 'payment', label: 'Payment Report' },
];

const monthKey = (d) => (d ? String(d).slice(0, 7) : '—');

export function buildReport(id, ctx) {
  const { loads = [], carriers = [], payments = [], exceptions = [], detention = [], settings = {} } = ctx;
  const carrierById = new Map(carriers.map((c) => [c.id, c]));
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const carrierOf = (l) => carrierById.get(l.carrier_id) || {};
  const econ = (l) => {
    const calc = computeEconomics(l, settings, carrierOf(l));
    return { calc, share: computeDispatcherShare(l, calc, carrierOf(l)) };
  };

  switch (id) {
    case 'load':
      return {
        columns: ['Load #', 'Broker', 'Route', 'Pickup', 'Delivery', 'Status', 'Rate'],
        rows: loads.map((l) => [
          l.load_number || '—', l.broker_name || '—',
          `${l.pickup_city || ''}, ${l.pickup_state || ''} → ${l.delivery_city || ''}, ${l.delivery_state || ''}`,
          dateStr(l.pickup_date), dateStr(l.delivery_date),
          STATUS_LABELS[l.status] || titleCase(l.status), currency(l.rate),
        ]),
      };
    case 'profit':
      return {
        columns: ['Load #', 'Revenue', 'Total miles', 'Trip cost', 'Margin', 'Margin %'],
        rows: loads.map((l) => {
          const { calc } = econ(l);
          return [l.load_number || '—', currency(calc.rate), num(calc.totalMiles), currency(calc.tripCost), currency(calc.margin), pct(calc.marginPct)];
        }),
      };
    case 'revenue': {
      const groups = new Map();
      for (const l of loads) {
        const k = monthKey(l.pickup_date || l.created_date);
        const g = groups.get(k) || { loads: 0, revenue: 0 };
        g.loads += 1; g.revenue += Number(l.rate) || 0;
        groups.set(k, g);
      }
      const rows = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, g]) => [k, num(g.loads), currency(g.revenue)]);
      return { columns: ['Month', 'Loads', 'Revenue'], rows };
    }
    case 'fee':
      return {
        columns: ['Load #', 'Mode', 'Base', 'Dispatcher fee', 'Carrier keeps'],
        rows: loads.map((l) => {
          const { share } = econ(l);
          return [l.load_number || '—', titleCase(share.feeMode), titleCase(share.feeBase), currency(share.fee), currency(share.carrierKeeps)];
        }),
      };
    case 'broker': {
      const groups = new Map();
      for (const l of loads) {
        const k = l.broker_name || 'Unknown';
        const g = groups.get(k) || { loads: 0, revenue: 0 };
        g.loads += 1; g.revenue += Number(l.rate) || 0;
        groups.set(k, g);
      }
      const rows = [...groups.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([k, g]) => [k, num(g.loads), currency(g.revenue), currency(g.loads ? g.revenue / g.loads : 0)]);
      return { columns: ['Broker', 'Loads', 'Revenue', 'Avg rate'], rows };
    }
    case 'carrier': {
      const groups = new Map();
      for (const l of loads) {
        const k = carrierOf(l).name || 'Unassigned';
        const { calc } = econ(l);
        const g = groups.get(k) || { loads: 0, revenue: 0, marginSum: 0 };
        g.loads += 1; g.revenue += Number(l.rate) || 0; g.marginSum += calc.marginPct;
        groups.set(k, g);
      }
      const rows = [...groups.entries()].map(([k, g]) => [k, num(g.loads), currency(g.revenue), pct(g.loads ? g.marginSum / g.loads : 0)]);
      return { columns: ['Carrier', 'Loads', 'Revenue', 'Avg margin %'], rows };
    }
    case 'exception':
      return {
        columns: ['Severity', 'Category', 'Issue', 'Load #', 'Status'],
        rows: exceptions.map((e) => [e.severity || '—', e.category || '—', e.title || '—', e.load_number || '—', titleCase(e.status)]),
      };
    case 'detention':
      return {
        columns: ['Load #', 'Wait (min)', 'Billable (hrs)', 'Rate/hr', 'Est. amount', 'Status'],
        rows: detention.map((d) => {
          const l = loadById.get(d.load_id);
          const c = computeDetention(d, settings);
          return [
            l?.load_number || '—',
            num(Math.round(c.waitMinutes)),
            num(Math.round(c.potentialHours * 100) / 100),
            currency(d.detention_rate),
            currency(c.potentialAmount),
            titleCase(d.status),
          ];
        }),
      };
    case 'payment':
      return {
        columns: ['Load #', 'Invoice date', 'Invoice amount', 'Paid date', 'Received', 'Status'],
        rows: payments.map((p) => [
          p.load_number || '—', dateStr(p.invoice_date), currency(p.invoice_amount),
          dateStr(p.paid_date), currency(p.amount_received),
          titleCase(paymentStatus(p, settings.expected_payment_days || 30)),
        ]),
      };
    default:
      return { columns: [], rows: [] };
  }
}

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}