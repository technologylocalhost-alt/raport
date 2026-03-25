'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LoginResponse {
  success: boolean;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Check if user is already logged in
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    // Cek apakah cookie masih ada (jika tidak, berarti session expired)
    const hasCookie = document.cookie.includes('accessToken') || document.cookie.includes('refreshToken');

    // Jika localStorage ada tapi cookie tidak ada, bersihkan localStorage
    if (accessToken && !hasCookie) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setIsLoading(false);
      return;
    }

    // Only redirect if BOTH token and user exist AND cookie masih valid
    if (accessToken && user && hasCookie) {
      try {
        const userData = JSON.parse(user);
        if (userData?.role) {
          redirectAfterLogin(userData.role);
          return;
        }
      } catch (error) {
        console.error('Error parsing user:', error);
        localStorage.clear();
      }
    }

    setIsLoading(false);
  }, [searchParams]);

  function redirectAfterLogin(role: string) {
    const redirectPath =
      role === 'ADMIN' || role === 'PRINCIPAL' ? '/admin/dashboard' :
      role === 'TEACHER' ? '/teacher/dashboard' :
      role === 'WALI_KELAS' ? '/wali-kelas/dashboard' :
      '/admin/dashboard';

    setTimeout(() => router.push(redirectPath), 50);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Ensure cookies are sent/received
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Store access token in localStorage
      localStorage.setItem('accessToken', data.accessToken!);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Small delay to ensure cookies are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to appropriate page
      redirectAfterLogin(data.user?.role || 'ADMIN');
    } catch (error) {
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
