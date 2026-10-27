import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  if (isLoadingAuth || !authChecked) return fallback;

  if (authError?.type === 'server') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-xl font-semibold">Cannot reach the server</h1>
          <p className="text-sm text-muted-foreground">{authError.message}</p>
          <button className="underline text-sm" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return unauthenticatedElement;
  return <Outlet />;
}
