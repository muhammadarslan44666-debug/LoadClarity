import React from 'react';

export default function ReportTable({ columns, rows }) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-muted text-muted-foreground text-xs uppercase">
          <tr>
            {columns.map((c) => <th key={c} className="text-left p-3 whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-accent">
              {r.map((v, j) => <td key={j} className="p-3 whitespace-nowrap">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}