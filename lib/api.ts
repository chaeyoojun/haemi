import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://if.io.kr/haemi-api';
const extraUrl = Constants.expoConfig?.extra?.apiUrl;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof extraUrl === 'string' && extraUrl) ||
  PRODUCTION_API_URL;

type ApiError = {
  error?: string;
};

let adminId = '';
let adminPassword = '';
let userName = '';
let userKey = '';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (adminId && adminPassword) {
    headers['X-Admin-Id'] = adminId;
    headers['X-Admin-Password'] = adminPassword;
  }
  if (userName) {
    headers['X-User-Name'] = encodeURIComponent(userName);
  }
  if (userKey) {
    headers['X-User-Key'] = encodeURIComponent(userKey);
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(payload.error || `요청에 실패했습니다 (${response.status})`);
  }
  return payload;
}

export function fileUrl(pathOrUrl: string) {
  if (!pathOrUrl) {
    return '';
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${API_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export const api = {
  setAdminAuth: (id: string, password: string) => {
    adminId = id;
    adminPassword = password;
  },
  clearAdminAuth: () => {
    adminId = '';
    adminPassword = '';
  },
  setUser: (name: string, key: string) => {
    userName = name;
    userKey = key;
  },
  clearUser: () => {
    userName = '';
    userKey = '';
  },
  list: <T>(path: string) => request<T[]>(path),
  get: <T>(path: string) => request<T>(path),
  create: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (path: string) => request<void>(path, { method: 'DELETE' }),
  upload: <T>(path: string, body: FormData, method: 'POST' | 'PATCH' = 'POST') =>
    request<T>(path, { method, body }),
};
