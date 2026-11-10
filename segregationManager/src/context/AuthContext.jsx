import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAuthToken, staffApi } from "../api/staffApi";

const STORAGE_KEY = "greengrocc_segregation_manager_auth";
const EXPECTED_ROLE = "segregation_manager";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persist = (nextStaff, nextToken) => {
    setStaff(nextStaff);
    setToken(nextToken);
    setAuthToken(nextToken);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ staff: nextStaff, token: nextToken }),
    );
  };

  const clear = () => {
    setStaff(null);
    setToken(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    const init = async () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }
      try {
        const saved = JSON.parse(raw);
        if (!saved?.token) {
          clear();
          return;
        }
        setAuthToken(saved.token);
        const res = await staffApi.me();
        const me = res.data.staff;
        if (me.role !== EXPECTED_ROLE) {
          clear();
          return;
        }
        persist(me, saved.token);
      } catch {
        clear();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (credentials) => {
    const res = await staffApi.login({ ...credentials, role: EXPECTED_ROLE });
    persist(res.data.staff, res.data.token);
    return res.data;
  };

  const logout = () => clear();

  const value = useMemo(
    () => ({
      staff,
      token,
      loading,
      isAuthenticated: Boolean(staff && token),
      login,
      logout,
    }),
    [staff, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
