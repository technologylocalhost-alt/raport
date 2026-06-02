/**
 * Client-side authentication utilities
 * Handles token management, logout, and auth state
 */

/**
 * Clear all authentication data and redirect to login
 * @param redirectPath - Optional path to redirect after login
 */
export function logout(redirectPath?: string) {
  console.log('[Auth Client] Logging out...');
  
  // Clear local storage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    
    // Call logout API to clear cookies
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => console.log('[Auth Client] Logout API called successfully'))
      .catch(err => console.warn('[Auth Client] Logout API call failed:', err));
    
    // Redirect to login
    const currentPath = redirectPath || window.location.pathname;
    if (currentPath !== '/login') {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    } else {
      window.location.href = '/login';
    }
  }
}

/**
 * Check if user is authenticated (has valid tokens)
 * Note: This only checks for token existence, not validity
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const accessToken = localStorage.getItem('accessToken');
  return !!accessToken;
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

/**
 * Set access token
 */
export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
}

/**
 * Get current user data from localStorage
 */
export function getCurrentUser(): any | null {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (e) {
    console.error('[Auth Client] Failed to parse user data:', e);
    return null;
  }
}

/**
 * Set current user data
 */
export function setCurrentUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Clear user data without redirecting
 */
export function clearAuthData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}
