import React from 'react';

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-10 h-10 text-muted-foreground/50 mb-3" />}
      <h3 className="font-heading text-xl">{title}</h3>
      {message && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}