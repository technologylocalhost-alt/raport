/**
 * Client-side authentication utilities
 * Handles token management, logout, and auth state
 */

import type { AuthUser } from '@/types';
import { devError, devWarn } from '@/lib/dev-log';

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'user';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function clearAuthData() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (!isBrowser()) return;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  if (!isBrowser()) return null;

  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as AuthUser;
  } catch (error) {
    devError('[Auth Client] Failed to parse user data:', error);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setCurrentUser(user: AuthUser | null) {
  if (!isBrowser()) return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return;
  }
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() && !!getCurrentUser();
}

export async function logout(redirectPath?: string) {
  if (!isBrowser()) return;

  const currentPath = redirectPath || window.location.pathname;
  const token = getAccessToken();

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (err) {
    devWarn('[Auth Client] Logout API call failed:', err);
  } finally {
    clearAuthData();
    sessionStorage.clear();

    if (currentPath !== '/login') {
      window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    } else {
      window.location.replace('/login');
    }
  }
}
