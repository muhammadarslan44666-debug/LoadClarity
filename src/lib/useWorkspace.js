import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export const userCompanyId = (user) => user?.company_id || user?.data?.company_id || null;

export function useWorkspace() {
  const { user } = useAuth();
  const companyId = userCompanyId(user);
  const [company, setCompany] = useState(null);
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      let comp = null;
      try { comp = await api.entities.Company.get(companyId); } catch (_) {}
      if (!comp) {
        const list = await api.entities.Company.filter({ created_by_id: user.id });
        comp = list[0] || null;
      }
      setCompany(comp);
      const cs = await api.entities.Carrier.filter({ company_id: companyId }, '-created_date', 100);
      setCarriers(cs || []);
    } catch (e) {
      console.error('workspace load failed', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, user]);

  useEffect(() => { load(); }, [load]);

  return { company, carriers, settings: company || {}, loading, refresh: load, companyId };
}