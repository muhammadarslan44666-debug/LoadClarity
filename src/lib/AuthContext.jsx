import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, getToken } from '@/api/client';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const applySession = useCallback((nextSession) => {
    setSession(nextSession || null);
    setUser(nextSession?.user || null);
    setIsAuthenticated(Boolean(nextSession?.user));
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data?.session) {
        applySession(data.session);
        return;
      }
      // Backwards compatibility for users authenticated through the legacy API.
      if (getToken()) {
        try {
          const legacyUser = await api.auth.me();
          setUser(legacyUser);
          setIsAuthenticated(true);
          setAuthError(null);
          setAuthChecked(true);
          setIsLoadingAuth(false);
          return;
        } catch (error) {
          if (error.status === 401) api.auth.logout(null);
          else setAuthError({ type: 'server', message: error.message });
        }
      }
      applySession(null);
    } catch (error) {
      setAuthError({ type: 'auth', message: error.message || 'Unable to check sign-in status.' });
      applySession(null);
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError({ type: 'auth', message: error.message });
      applySession(data?.session || null);
    }).catch((error) => {
      if (!active) return;
      setAuthError({ type: 'auth', message: error.message || 'Unable to check sign-in status.' });
      applySession(null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) applySession(nextSession);
    });
    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [applySession]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);
    api.auth.logout(null);
    await supabase.auth.signOut().catch(() => {});
    if (shouldRedirect) window.location.assign('/login');
  };

  const navigateToLogin = () => window.location.assign('/login');

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated, isLoadingAuth, authChecked, authError, logout, navigateToLogin, checkUserAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
