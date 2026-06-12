'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { apiFetch } from '@/lib/api-client';
import {
  clearAuthData,
  fetchCurrentUser,
  setAccessToken,
  setCurrentUser,
} from '@/lib/auth/client';
import { resolveMenuHref } from '@/lib/menu-config';
import { fetchAllowedMenuPaths } from '@/lib/rbac-client';
import { devError } from '@/lib/dev-log';

interface LoginResponse {
  success: boolean;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    schoolId: string;
    isActive?: boolean;
    bagian?: string[];
  };
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const redirectAfterLogin = useCallback(async (role: string) => {
    const fallbackPath =
      role === 'ADMIN' || role === 'PRINCIPAL' ? '/admin/dashboard' :
      role === 'TEACHER' ? '/teacher/dashboard' :
      role === 'WALI_KELAS' ? '/wali-kelas/dashboard' :
      '/admin/dashboard';

    const preferredPrefix =
      role === 'ADMIN' || role === 'PRINCIPAL' ? '/admin' :
      role === 'TEACHER' ? '/teacher' :
      role === 'WALI_KELAS' ? '/wali-kelas' :
      '/admin';

    try {
      const menuGroup =
        role === 'ADMIN' || role === 'PRINCIPAL' ? 'admin' :
        role === 'TEACHER' ? 'teacher' :
        role === 'WALI_KELAS' ? 'wali-kelas' :
        'admin';

      const { allowedPaths, hasRestrictions } = await fetchAllowedMenuPaths(menuGroup);

      if (hasRestrictions && allowedPaths.length > 0) {
        if (allowedPaths.includes(fallbackPath)) {
          setTimeout(() => router.push(fallbackPath), 50);
          return;
        }

        const sameRolePath = allowedPaths.find((path) => path.startsWith(preferredPrefix));
        if (sameRolePath) {
          setTimeout(() => router.push(sameRolePath), 50);
          return;
        }

        setTimeout(() => router.push(resolveMenuHref(allowedPaths[0]!, role)), 50);
        return;
      }

      if (hasRestrictions && allowedPaths.length === 0) {
        setTimeout(() => router.push('/access-denied'), 50);
        return;
      }
    } catch (error) {
      devError('Failed to resolve post-login redirect:', error);
    }

    setTimeout(() => router.push(fallbackPath), 50);
  }, [router]);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const currentUser = await fetchCurrentUser();

      if (!active) return;

      if (currentUser?.role) {
        await redirectAfterLogin(currentUser.role);
        return;
      }

      setIsLoading(false);
    }

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, [redirectAfterLogin]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        skipRefresh: true,
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        clearAuthData();
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      setAccessToken(data.accessToken || null);

      if (data.user) {
        const userRole = data.user.role;
        setCurrentUser({
          ...data.user,
          isActive: data.user.isActive ?? true,
          bagian: data.user.bagian ?? [],
          role: userRole,
        });
      } else {
        setCurrentUser(null);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      await redirectAfterLogin(data.user?.role || UserRole.ADMIN);
    } catch (error) {
      clearAuthData();
      setError(error instanceof Error ? error.message : 'An error occurred');
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-1 sm:mb-2">
          Raport
        </h1>
        <p className="text-center text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
          Sistem Manajemen Raport Sekolah
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-500"
              placeholder="admin@sekolah.id"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors text-base sm:text-lg min-h-[44px] sm:min-h-auto"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
