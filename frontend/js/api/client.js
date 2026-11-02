// js/api/client.js
// Central native Fetch client for all API calls.
// Attaches JWT bearer tokens, parses JSON, and auto-refreshes tokens on 401.

const API_BASE_URL = typeof window !== 'undefined' && window.BB_API_BASE_URL
  ? window.BB_API_BASE_URL
  : 'http://localhost:8000/api/v1';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

function buildUrl(endpoint, params) {
  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }
  return url;
}

export async function request(endpoint, options = {}) {
  const { method = 'GET', data, params, headers = {}, _retry = false } = options;

  const url = buildUrl(endpoint, params);
  const reqHeaders = new Headers(headers);

  if (!reqHeaders.has('Content-Type') && !(data instanceof FormData)) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  const isAuthEndpoint = endpoint.includes('/auth/login/') ||
                         endpoint.includes('/auth/register/') ||
                         endpoint.includes('/auth/token/refresh/');
  const token = localStorage.getItem('access_token');
  if (token && !isAuthEndpoint && !reqHeaders.has('Authorization')) {
    reqHeaders.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions = {
    method,
    headers: reqHeaders,
  };

  if (data !== undefined && data !== null) {
    fetchOptions.body = data instanceof FormData ? data : JSON.stringify(data);
  }

  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (netErr) {
    const error = new Error(netErr.message || 'Network error');
    error.isNetworkError = true;
    throw error;
  }

  // Handle 401 with Token Refresh
  if (res.status === 401 && !_retry && localStorage.getItem('refresh_token')) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          return request(endpoint, {
            ...options,
            _retry: true,
            headers: { ...headers, Authorization: `Bearer ${newToken}` },
          });
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: localStorage.getItem('refresh_token') }),
      });

      if (!refreshRes.ok) {
        throw new Error('Refresh token invalid or expired');
      }

      const refreshData = await refreshRes.json();
      const newAccess = refreshData.access;
      localStorage.setItem('access_token', newAccess);

      // If Django SimpleJWT returns a rotated refresh token, persist it immediately
      if (refreshData.refresh) {
        localStorage.setItem('refresh_token', refreshData.refresh);
      }

      processQueue(null, newAccess);

      return request(endpoint, {
        ...options,
        _retry: true,
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
      });
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');

      // Determine redirect path to login
      const isSub = window.location.pathname.includes('/patient/') ||
                    window.location.pathname.includes('/donor/') ||
                    window.location.pathname.includes('/admin/');
      window.location.href = isSub ? '../login.html' : 'login.html';
      const err = new Error('Session expired');
      err.response = { status: 401, data: { detail: 'Session expired' } };
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  // Parse JSON response body if present
  let responseData = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await res.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await res.text();
    } catch {
      responseData = null;
    }
  }

  if (!res.ok) {
    const error = new Error(`HTTP Error ${res.status}`);
    error.status = res.status;
    error.response = {
      status: res.status,
      data: responseData,
      headers: res.headers,
    };
    throw error;
  }

  return {
    data: responseData,
    status: res.status,
    headers: res.headers,
    ok: res.ok,
  };
}

export const client = {
  request,
  get: (url, config = {}) => request(url, { ...config, method: 'GET' }),
  post: (url, data, config = {}) => request(url, { ...config, method: 'POST', data }),
  patch: (url, data, config = {}) => request(url, { ...config, method: 'PATCH', data }),
  put: (url, data, config = {}) => request(url, { ...config, method: 'PUT', data }),
  delete: (url, config = {}) => request(url, { ...config, method: 'DELETE' }),
};

export default client;
