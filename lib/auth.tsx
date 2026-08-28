import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';

import { api } from '@/lib/api';

export const ADMIN_ID = 'admin';
export const ADMIN_PASSWORD = '230408';
export const ADMIN_DISPLAY_NAME = '관리자';

const AUTH_KEY = 'haemi.auth';
const LAST_NAME_KEY = 'haemi.lastName';
const VOTER_KEY = 'haemi.voterKey';

export type Role = 'admin' | 'user';

type StoredAuth = {
  role: Role;
  name: string;
  key: string;
};

type AuthContextValue = {
  ready: boolean;
  role: Role | null;
  isAdmin: boolean;
  displayName: string;
  enterAsUser: (name: string) => void;
  loginAdmin: (password: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeName(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 20);
}

function newVoterKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function persistSession(role: Role, name: string, key: string) {
  const payload: StoredAuth = { role, name, key };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  if (role === 'user') {
    await AsyncStorage.setItem(LAST_NAME_KEY, name);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [voterKey, setVoterKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let key = await AsyncStorage.getItem(VOTER_KEY);
        const lastName = (await AsyncStorage.getItem(LAST_NAME_KEY)) || '';
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        let stored: StoredAuth | null = null;
        if (raw) {
          try {
            stored = JSON.parse(raw) as StoredAuth;
          } catch {
            stored = null;
          }
        }
        if (stored?.key) {
          key = stored.key;
        }
        if (!key) {
          key = newVoterKey();
        }
        await AsyncStorage.setItem(VOTER_KEY, key);
        if (cancelled) {
          return;
        }
        setVoterKey(key);
        if (stored && (stored.role === 'admin' || stored.role === 'user')) {
          const name = normalizeName(stored.name || (stored.role === 'admin' ? ADMIN_DISPLAY_NAME : ''));
          if (name.length >= 2) {
            if (stored.role === 'admin') {
              api.setAdminAuth(ADMIN_ID, ADMIN_PASSWORD);
            } else {
              api.clearAdminAuth();
            }
            api.setUser(name, key);
            setRole(stored.role);
            setDisplayName(name);
            return;
          }
        }
        setDisplayName(normalizeName(lastName));
      } catch {
        // Keep login screen if storage is unavailable.
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      role,
      isAdmin: role === 'admin',
      displayName,
      enterAsUser: (name) => {
        const trimmed = normalizeName(name);
        if (trimmed.length < 2) {
          throw new Error('이름을 두 글자 이상 입력해 주세요.');
        }
        const key = voterKey || newVoterKey();
        api.clearAdminAuth();
        api.setUser(trimmed, key);
        setVoterKey(key);
        setDisplayName(trimmed);
        setRole('user');
        void persistSession('user', trimmed, key);
        void AsyncStorage.setItem(VOTER_KEY, key);
      },
      loginAdmin: (password) => {
        if (password !== ADMIN_PASSWORD) {
          throw new Error('비밀번호가 올바르지 않습니다.');
        }
        const key = voterKey || newVoterKey();
        api.setAdminAuth(ADMIN_ID, ADMIN_PASSWORD);
        api.setUser(ADMIN_DISPLAY_NAME, key);
        setVoterKey(key);
        setDisplayName(ADMIN_DISPLAY_NAME);
        setRole('admin');
        void persistSession('admin', ADMIN_DISPLAY_NAME, key);
        void AsyncStorage.setItem(VOTER_KEY, key);
      },
      logout: () => {
        api.clearAdminAuth();
        api.clearUser();
        setRole(null);
        if (role !== 'admin') {
          setDisplayName(displayName);
        } else {
          void AsyncStorage.getItem(LAST_NAME_KEY).then((last) => {
            setDisplayName(normalizeName(last || ''));
          });
        }
        void AsyncStorage.removeItem(AUTH_KEY);
      },
    }),
    [ready, role, displayName, voterKey]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function confirmLogout(logout: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm('로그아웃할까요?')) {
      logout();
    }
    return;
  }
  Alert.alert('로그아웃할까요?', '다른 이름이나 관리자로 다시 들어갈 수 있습니다.', [
    { text: '닫기', style: 'cancel' },
    { text: '로그아웃', style: 'destructive', onPress: logout },
  ]);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider가 필요합니다.');
  }
  return value;
}
