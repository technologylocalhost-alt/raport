'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Check if user is already logged in
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      redirectAfterLogin(user.role);
    }
  }, []);

  function redirectAfterLogin(role: string) {
    // Get redirect parameter from URL
    const searchParams = new URLSearchParams(window.location.search);
    const redirectTo = searchParams.get('redirect');
    
    // If there's a redirect parameter and it's a valid internal route, use it
    if (redirectTo && redirectTo.startsWith('/')) {
      router.push(redirectTo);
      return;
    }

    // Otherwise, redirect based on role
    if (role === 'ADMIN' || role === 'PRINCIPAL') {
      router.push('/admin/dashboard');
    } else if (role === 'TEACHER') {
      router.push('/teacher/dashboard');
    } else if (role === 'WALI_KELAS') {
      router.push('/wali-kelas/dashboard');
    } else {
      router.push('/admin/dashboard'); // fallback
    }
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
    } finally {
      setIsLoading(false);
    }
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
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

        <p className="text-center text-xs sm:text-sm text-gray-600 mt-6 sm:mt-8">
          Use demo credentials during development
        </p>
      </div>
    </div>
  );
}
