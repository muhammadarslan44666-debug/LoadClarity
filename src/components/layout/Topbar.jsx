import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Sidebar from './Sidebar';
import { useCarrier } from './CarrierContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function Topbar({ carriers }) {
  const { carrierId, setCarrierId } = useCarrier();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [q, setQ] = useState('');

  // Safe Array Check: Ensure carriers is strictly an array
  const carrierList = Array.isArray(carriers) ? carriers : [];

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="px-4 py-5 border-b border-border">
            <span className="font-heading text-2xl">LoadClarity</span>
          </div>
          <Sidebar onNavigate={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))} />
        </SheetContent>
      </Sheet>

      <span className="hidden lg:block font-heading text-xl tracking-wide">LoadClarity</span>

      <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search loads, brokers, references…"
          className="pl-9 h-10"
        />
      </form>

      <div className="flex items-center gap-2">
        <select
          value={carrierId}
          onChange={(e) => setCarrierId(e.target.value)}
          className={cn(
            'h-10 rounded-md border border-input bg-background px-3 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label="Carrier filter"
        >
          <option value="all">All carriers</option>
          {carrierList.map((c) => (
            <option key={c.id || c.name} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="icon" onClick={() => logout()} title="Log out">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}