/**
 * Enhanced fetch with automatic token injection for API calls
 * Adds Authorization header with access token from localStorage
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { skipAuth?: boolean } = {}
) {
  const { skipAuth = false, ...fetchOptions } = options;

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

  const response = await fetch(url, init);

  // Handle 401 - token might be expired
  if (response.status === 401 && !skipAuth) {
    // Token might be expired, try to refresh
    // For now, redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }

  return response;
}
