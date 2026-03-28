'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        const token = localStorage.getItem('accessToken');

        // Call logout API
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        });

        console.log('[Logout] API response:', response.status);
      } catch (error) {
        console.error('[Logout] API error:', error);
      } finally {
        // Always clear storage regardless of API response
        localStorage.clear();
        sessionStorage.clear();

        // Clear user from any other storage
        if (typeof window !== 'undefined') {
          // Delete auth cookies by setting them to empty with past date
          document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          document.cookie = 'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }

        // Add a small delay to ensure everything is cleared
        await new Promise(resolve => setTimeout(resolve, 100));

        // Navigate to login with hard refresh to bust cache
        window.location.href = '/login?ts=' + Date.now();
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Logging out...</h1>
        <p className="text-gray-600">Please wait while we log you out.</p>
      </div>
    </div>
  );
}
