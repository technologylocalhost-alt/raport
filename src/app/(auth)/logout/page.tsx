'use client';

import { useEffect } from 'react';
import { logout } from '@/lib/auth/client';

export default function LogoutPage() {
  useEffect(() => {
    void logout();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Logging out...</h1>
        <p className="text-gray-600">Please wait while we log you out.</p>
      </div>
    </div>
  );
}
