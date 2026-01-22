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
  const [role, setRoleState] = useState<UserRole>(() => {
    const storedRole = localStorage.getItem('cronox.role');
    if (storedRole === 'buyer' || storedRole === 'professional') {
      return storedRole;
    }
    return null;
  });
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('cronox.token'));
  const [isAuthenticated, setAuthenticatedState] = useState(Boolean(localStorage.getItem('cronox.token')));

  const setRole = useCallback((nextRole: UserRole) => {
    setRoleState(nextRole);
    if (nextRole) {
      localStorage.setItem('cronox.role', nextRole);
    } else {
      localStorage.removeItem('cronox.role');
    }
  }, []);

  const setAuthenticated = useCallback((auth: boolean) => {
    setAuthenticatedState(auth);
    if (!auth) {
      localStorage.removeItem('cronox.token');
      setTokenState(null);
    }
  }, []);

  const setToken = useCallback((nextToken: string | null) => {
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem('cronox.token', nextToken);
      setAuthenticatedState(true);
    } else {
      localStorage.removeItem('cronox.token');
      setAuthenticatedState(false);
    }
  }, []);

  const logout = useCallback(() => {
    setRoleState(null);
    setTokenState(null);
    setAuthenticatedState(false);
    localStorage.removeItem('cronox.role');
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
