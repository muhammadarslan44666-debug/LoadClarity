import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Zap, Package, AlertTriangle, Building2, Wrench,
  Users, Clock, DollarSign, Settings as SettingsIcon, Search, Tag, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/quick-check', label: 'Quick check', icon: Zap },
  { to: '/loads', label: 'Loads', icon: Package },
  { to: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { to: '/carriers', label: 'Carriers', icon: Building2 },
  { to: '/fleet', label: 'Fleet', icon: Wrench },
  { to: '/brokers', label: 'Brokers', icon: Users },
  { to: '/detention', label: 'Detention', icon: Clock },
  { to: '/payments', label: 'Payments', icon: DollarSign },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/pricing', label: 'Pricing', icon: Tag },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ onNavigate }) {
  const loc = useLocation();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'border-l-blue-600 bg-blue-50 text-blue-950 font-semibold shadow-sm [&>svg]:text-blue-700'
                : 'border-l-transparent text-slate-600 hover:border-l-slate-300 hover:bg-slate-50 hover:text-slate-950'
            )
          }
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}