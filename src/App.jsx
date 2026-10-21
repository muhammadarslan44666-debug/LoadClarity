import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppShell from '@/components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import QuickCheck from './pages/QuickCheck';
import Loads from './pages/Loads';
import LoadDetail from './pages/LoadDetail';
import LoadEdit from './pages/LoadEdit';
import Carriers from './pages/Carriers';
import Fleet from './pages/Fleet';
import Brokers from './pages/Brokers';
import Exceptions from './pages/Exceptions';
import Detention from './pages/Detention';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Search from './pages/Search';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import PublicInfo, { SiteFooter } from './pages/PublicInfo';
import FeedbackPage from './pages/FeedbackPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/privacy" element={<PublicInfo />} />
      <Route path="/terms" element={<PublicInfo />} />
      <Route path="/faq" element={<PublicInfo />} />
      <Route path="/contact" element={<PublicInfo />} />
      <Route path="/about" element={<PublicInfo />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/quick-check" element={<QuickCheck />} />
          <Route path="/loads" element={<Loads />} />
          <Route path="/loads/new" element={<LoadEdit />} />
          <Route path="/loads/:id" element={<LoadDetail />} />
          <Route path="/loads/:id/edit" element={<LoadEdit />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/carriers" element={<Carriers />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/detention" element={<Detention />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
          <SiteFooter />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App