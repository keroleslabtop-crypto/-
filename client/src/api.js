// Centralized API helper with auth token handling

const BASE_URL = '/api';

export function getToken() {
  return localStorage.getItem('contest_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('contest_token', token);
  } else {
    localStorage.removeItem('contest_token');
  }
}

export function getSavedUser() {
  try {
    const raw = localStorage.getItem('contest_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setSavedUser(user) {
  if (user) {
    localStorage.setItem('contest_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('contest_user');
  }
}

export async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'حدث خطأ في الاتصال بالخادم');
  }

  return result;
}
