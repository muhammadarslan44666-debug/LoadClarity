import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import ReportTable from '@/components/reports/ReportTable';
import EmptyState from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { REPORT_TYPES, buildReport, toCSV } from '@/lib/reports';
import { BarChart3, Download } from 'lucide-react';

const inRange = (d, from, to) => {
  if (!d) return !from && !to;
  const day = String(d).slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

export default function Reports() {
  const { companyId, settings } = useWorkspace();
  const [data, setData] = useState({ loads: [], carriers: [], payments: [], exceptions: [], detention: [] });
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('load');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 500),
      api.entities.Carrier.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.Payment.filter({ company_id: companyId }, '-created_date', 500),
      api.entities.LoadException.filter({ company_id: companyId }, '-created_date', 500),
      api.entities.DetentionEvent.filter({ company_id: companyId }, '-created_date', 500),
    ]).then(([loads, carriers, payments, exceptions, detention]) => {
      setData({ loads: loads || [], carriers: carriers || [], payments: payments || [], exceptions: exceptions || [], detention: detention || [] });
    }).finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => ({
    loads: data.loads.filter((l) => inRange(l.created_date, from, to)),
    carriers: data.carriers,
    payments: data.payments.filter((p) => inRange(p.invoice_date || p.created_date, from, to)),
    exceptions: data.exceptions.filter((e) => inRange(e.created_date, from, to)),
    detention: data.detention.filter((d) => inRange(d.created_date, from, to)),
  }), [data, from, to]);

  const report = useMemo(() => buildReport(type, { ...filtered, settings }), [type, filtered, settings]);

  const exportCSV = () => {
    const csv = toCSV(report.columns, report.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loadclarity-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  const label = REPORT_TYPES.find((r) => r.id === type)?.label || 'Report';

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Operational, financial, and exception reports from your saved data."
        actions={<Button onClick={exportCSV} disabled={!report.rows.length}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>}
      />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="sm:w-56">
          <Label className="text-xs">Report</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{REPORT_TYPES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
        </div>
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={BarChart3} title={`No ${label.toLowerCase()} data`} message="Adjust the date range or add records." />
      ) : (
        <ReportTable columns={report.columns} rows={report.rows} />
      )}
    </div>
  );
}