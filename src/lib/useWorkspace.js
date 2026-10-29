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

    try {
      const { data: workspaces, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (!error && workspaces && workspaces.length > 0) {
        setCompany(workspaces[0]);
        try {
          const cs = await api.entities.Carrier.filter({ company_id: workspaces[0].id }, '-created_date', 100);
          setCarriers(cs || []);
        } catch (err) {
          setCarriers([]);
        }
      } else {
        setCompany(null);
      }
    } catch (e) {
      console.error('workspace load failed', e);
      setCompany(null);
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