import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/lib/api';

export const ADMIN_ID = 'admin';
export const ADMIN_PASSWORD = 'hmfpv';

export type Role = 'admin' | 'user';

type AuthContextValue = {
  role: Role | null;
  isAdmin: boolean;
  enterAsUser: () => void;
  loginAdmin: (id: string, password: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isAdmin: role === 'admin',
      enterAsUser: () => {
        api.clearAdminAuth();
        setRole('user');
      },
      loginAdmin: (id, password) => {
        if (id.trim() !== ADMIN_ID || password !== ADMIN_PASSWORD) {
          throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
        api.setAdminAuth(ADMIN_ID, ADMIN_PASSWORD);
        setRole('admin');
      },
    }),
    [role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider가 필요합니다.');
  }
  return value;
}
