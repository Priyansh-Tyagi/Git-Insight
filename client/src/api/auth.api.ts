import { api } from '../lib/axiosInstance';

export interface CurrentUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export function githubLoginUrl(): string {
  return `${import.meta.env.VITE_API_URL}/api/auth/github`;
}

export async function fetchMe(): Promise<CurrentUser | null> {
  try {
    const res = await api.get('/api/auth/me');
    return res.data.data;
  } catch {
    return null; // 401 just means logged out — not an app-breaking error
  }
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}
