/**
 * Enhanced fetch with automatic token injection and refresh for API calls
 * Adds Authorization header with access token from localStorage
 * Automatically refreshes token on 401 and retries the request
 */

import { logout } from './auth/client';

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

function subscribeTokenRefresh(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback);
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Auth] Token refresh failed:', response.status);
      
      // Try to get error details
      try {
        const errorData = await response.json();
        if (errorData.shouldLogout) {
          console.log('[Auth] Server indicated should logout');
        }
      } catch (e) {
        // Ignore JSON parse error
      }
      
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.accessToken) {
      // Store new token
      localStorage.setItem('accessToken', data.accessToken);
      console.log('[Auth] Token refreshed successfully');
      return data.accessToken;
    }

    console.warn('[Auth] Token refresh response invalid:', data);
    
    // Check if should logout
    if (data.shouldLogout) {
      console.log('[Auth] Server indicated should logout');
    }
    
    return null;
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    return null;
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit & { skipAuth?: boolean; skipRefresh?: boolean } = {}
) {
  const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;

  // Prepare headers
  const headers = new Headers(fetchOptions.headers);

  // Add Authorization header if token exists and skipAuth is false
  if (!skipAuth && typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Ensure credentials included for cookies
  const init: RequestInit = {
    ...fetchOptions,
    headers,
    credentials: 'include',
  };

  let response = await fetch(url, init);

  // Handle 401 - token might be expired
  if (response.status === 401 && !skipAuth && !skipRefresh) {
    console.log('[Auth] Received 401, attempting token refresh...');
    
    // If already refreshing, wait for it to complete
    if (isRefreshing) {
      console.log('[Auth] Refresh already in progress, waiting...');
      
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            // Retry original request with new token
            headers.set('Authorization', `Bearer ${newToken}`);
            fetch(url, { ...init, headers })
              .then(resolve)
              .catch(() => {
                logout();
                resolve(response); // Return original 401 response
              });
          } else {
            // Refresh failed, logout
            logout();
            resolve(response);
          }
        });
      });
    }

    // Start refresh process
    isRefreshing = true;
    
    try {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Notify all waiting requests
        onRefreshed(newToken);
        isRefreshing = false;
        
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...init, headers });
        
        return response;
      } else {
        // Refresh failed
        onRefreshed(null);
        isRefreshing = false;
        logout();
        return response;
      }
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error);
      onRefreshed(null);
      isRefreshing = false;
      logout();
      return response;
    }
  }

  return response;
}

