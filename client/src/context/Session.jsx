// Remembers who is logged in, for every page.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'mentor') return '/mentor';
  return '/dashboard';
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => api('/auth/me').then(setUser).catch(() => setUser(null)), []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, setUser, loading, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
