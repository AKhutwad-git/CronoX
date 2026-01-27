import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'buyer' | 'professional' | null;

interface RoleContextType {
  role: UserRole;
  isAuthenticated: boolean;
  token: string | null;
  setRole: (role: UserRole) => void;
  setAuthenticated: (auth: boolean) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const resolveRoleFromToken = useCallback((jwt: string | null): UserRole => {
    if (!jwt) {
      return null;
    }

    const parts = jwt.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload =
        payloadBase64.length % 4 === 0 ? payloadBase64 : payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)), '=');
      const decoded = atob(paddedPayload);
      const payload = JSON.parse(decoded) as { role?: unknown };
      const roleValue = payload?.role;
      if (roleValue === 'buyer' || roleValue === 'professional') {
        return roleValue;
      }
    } catch {
      return null;
    }

    return null;
  }, []);

  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('cronox.token'));
  const [role, setRoleState] = useState<UserRole>(() => resolveRoleFromToken(localStorage.getItem('cronox.token')));
  const [isAuthenticated, setAuthenticatedState] = useState(Boolean(localStorage.getItem('cronox.token')));

  const setRole = useCallback((nextRole: UserRole) => {
    if (token) {
      return;
    }
    setRoleState(nextRole);
  }, [token]);

  const setAuthenticated = useCallback((auth: boolean) => {
    setAuthenticatedState(auth);
    if (!auth) {
      localStorage.removeItem('cronox.token');
      setTokenState(null);
      setRoleState(null);
    }
  }, []);

  const setToken = useCallback((nextToken: string | null) => {
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem('cronox.token', nextToken);
      setAuthenticatedState(true);
      setRoleState(resolveRoleFromToken(nextToken));
    } else {
      localStorage.removeItem('cronox.token');
      setAuthenticatedState(false);
      setRoleState(null);
    }
  }, [resolveRoleFromToken]);

  const logout = useCallback(() => {
    setRoleState(null);
    setTokenState(null);
    setAuthenticatedState(false);
    localStorage.removeItem('cronox.token');
  }, []);

  return (
    <RoleContext.Provider value={{ role, isAuthenticated, token, setRole, setAuthenticated, setToken, logout }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
