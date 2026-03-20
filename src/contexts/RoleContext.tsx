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
  const decodeTokenPayload = useCallback((jwt: string | null) => {
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
      return JSON.parse(decoded) as { role?: unknown; exp?: unknown };
    } catch {
      return null;
    }
  }, []);

  const isTokenValid = useCallback(
    (jwt: string | null) => {
      const payload = decodeTokenPayload(jwt);
      if (!payload) {
        return false;
      }
      if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
        return false;
      }
      return true;
    },
    [decodeTokenPayload]
  );

  const resolveRoleFromToken = useCallback(
    (jwt: string | null): UserRole => {
      const payload = decodeTokenPayload(jwt);
      if (!payload) {
        return null;
      }
      if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
        return null;
      }
      const roleValue = payload?.role;
      if (roleValue === 'buyer' || roleValue === 'professional') {
        return roleValue;
      }
      return null;
    },
    [decodeTokenPayload]
  );

  const readStoredToken = useCallback(() => {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const stored = localStorage.getItem('cronox.token');
      if (!stored) {
        return null;
      }
      if (!isTokenValid(stored)) {
        // Token is invalid/expired but do not force clear it automatically.
        // The user might be able to refresh it later or auth context can handle it via an explicit logout.
        return null;
      }
      return stored;
    } catch {
      return null;
    }
  }, [isTokenValid]);

  const initialToken = readStoredToken();
  const [token, setTokenState] = useState<string | null>(initialToken);
  const [role, setRoleState] = useState<UserRole>(() => resolveRoleFromToken(initialToken));
  const [isAuthenticated, setAuthenticatedState] = useState(Boolean(initialToken));

  const setRole = useCallback((nextRole: UserRole) => {
    if (token) {
      return;
    }
    setRoleState(nextRole);
  }, [token]);

  const setAuthenticated = useCallback((auth: boolean) => {
    setAuthenticatedState(auth);
    if (!auth) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cronox.token');
      }
      setTokenState(null);
      setRoleState(null);
    }
  }, []);

  const setToken = useCallback(
    (nextToken: string | null) => {
      setTokenState(nextToken);
      if (nextToken && isTokenValid(nextToken)) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cronox.token', nextToken);
        }
        setAuthenticatedState(true);
        setRoleState(resolveRoleFromToken(nextToken));
      } else {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('cronox.token');
        }
        setAuthenticatedState(false);
        setRoleState(null);
      }
    },
    [isTokenValid, resolveRoleFromToken]
  );

  const logout = useCallback(() => {
    setRoleState(null);
    setTokenState(null);
    setAuthenticatedState(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('cronox.token');
    }
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
