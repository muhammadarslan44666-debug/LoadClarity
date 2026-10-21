import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { userCompanyId } from '@/lib/useWorkspace';
import { CarrierProvider } from './CarrierContext';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Onboarding from '@/pages/Onboarding';
import { useWorkspace } from '@/lib/useWorkspace';

export default function AppShell() {
  const { user } = useAuth();
  const companyId = userCompanyId(user);
  const { company, carriers, loading } = useWorkspace();

  if (!companyId) return <Onboarding />;
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CarrierProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar">
          <div className="px-4 py-5 border-b border-border">
            <span className="font-heading text-2xl">LoadClarity</span>
          </div>
          <Sidebar />
        </aside>
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar carriers={carriers} />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </CarrierProvider>
  );
}