import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until we know if a session cookie exists

  useEffect(() => {
    authApi
      .getMe()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null)) // 401 = not logged in, that's fine
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, coords) => {
    const { user } = await authApi.login({ email, password, ...(coords ? { coords } : {}) });
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { user } = await authApi.register(data);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, logout, isAdmin: user?.role === 'admin', isDriver: user?.role === 'driver' }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
