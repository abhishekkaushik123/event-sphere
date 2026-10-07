import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('es_token'));

  const logout = useCallback(() => {
    localStorage.removeItem('es_token');
    setUser(null);
  }, []);

  // Restore the session from a saved token on page load.
  useEffect(() => {
    if (!localStorage.getItem('es_token')) return;
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('es_token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('es-logout', logout);
    return () => window.removeEventListener('es-logout', logout);
  }, [logout]);

  const signIn = ({ token, user }) => {
    localStorage.setItem('es_token', token);
    setUser(user);
  };

  return <AuthContext.Provider value={{ user, loading, signIn, logout }}>{children}</AuthContext.Provider>;
}
