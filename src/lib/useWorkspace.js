import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export const userCompanyId = (user) => user?.company_id || user?.data?.company_id || null;

export function useWorkspace() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { 
      setLoading(false); 
      return; 
    }
    
    setLoading(true);
    try {
      // Direct Supabase query to check the 'workspaces' table for the logged-in user
      const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;

      const comp = workspaces && workspaces.length > 0 ? workspaces[0] : null;
      setCompany(comp);

      if (comp) {
        // Fetch carriers if workspace exists
        const cs = await api.entities.Carrier.filter({ company_id: comp.id }, '-created_date', 100).catch(() => []);
        setCarriers(cs || []);
      }
    } catch (e) {
      console.error('workspace load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { 
    load(); 
  }, [load]);

  return { 
    company, 
    carriers, 
    settings: company || {}, 
    loading, 
    refresh: load, 
    companyId: company?.id || null 
  };
}